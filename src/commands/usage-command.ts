import {
  formatServiceUsageData,
  formatServiceUsageDataAsJson,
  formatServiceUsageAsTsv,
  toJsonObject,
} from "../utils/format-service-usage.js";
import { formatPrometheusMetrics } from "../utils/format-prometheus-metrics.js";
import type {
  ApiError,
  ServiceResult,
  ServiceUsageData,
} from "../types/domain.js";
import type { UsageCommandOptions } from "./fetch-service-usage.js";
import {
  fetchServiceUsage,
  selectServicesToQuery,
} from "./fetch-service-usage.js";
import { fetchServiceUsageWithAutoReauth } from "./fetch-service-usage-with-reauth.js";
import { isAuthFailure } from "./run-auth-setup.js";
import { chalk } from "../utils/color.js";

/**
 * Fetches usage for services using hybrid strategy:
 * 1. Try all services in parallel first (fast path for valid credentials)
 * 2. If any service fails with auth error, retry those sequentially with re-auth
 *
 * This maintains ~2s response time when credentials are valid while gracefully
 * handling authentication failures that require interactive prompts.
 */
export async function fetchServicesWithHybridStrategy(
  servicesToQuery: string[],
  interactive: boolean,
): Promise<ServiceResult[]> {
  // First attempt: fetch all services in parallel
  const parallelResults = await Promise.all(
    servicesToQuery.map(async (serviceName): Promise<ServiceResult> => {
      const result = await fetchServiceUsage(serviceName);
      return { service: serviceName, result };
    }),
  );

  // Check for auth errors
  const authFailures = parallelResults.filter(({ result }) =>
    isAuthFailure(result),
  );

  // If no auth failures, return parallel results
  if (authFailures.length === 0 || !interactive) {
    return parallelResults;
  }

  const shouldShowProgress = process.stderr.isTTY;

  // Retry auth failures sequentially with re-authentication
  const retryResults: ServiceResult[] = [];
  for (const [index, { service }] of authFailures.entries()) {
    if (shouldShowProgress) {
      console.error(
        chalk.dim(
          `[${String(index + 1)}/${String(authFailures.length)}] Re-authenticating ${service}...`,
        ),
      );
    }
    const result = await fetchServiceUsageWithAutoReauth(service, interactive);
    retryResults.push(result);
  }

  if (shouldShowProgress) {
    console.error(
      chalk.green(
        `✓ Completed ${String(retryResults.length)} re-authentication${retryResults.length === 1 ? "" : "s"}\n`,
      ),
    );
  }

  // Merge results: keep successful parallel results, replace auth failures with retries
  // Build a map for O(1) lookups instead of O(n²) find() calls
  const retryMap = new Map(retryResults.map((r) => [r.service, r]));
  return parallelResults.map(
    (parallelResult) => retryMap.get(parallelResult.service) ?? parallelResult,
  );
}

/**
 * Executes the usage command
 */
export async function usageCommand(
  options: UsageCommandOptions,
): Promise<void> {
  const servicesToQuery = selectServicesToQuery(options.service);
  const interactive = options.interactive ?? false;

  // Fetch usage data using hybrid parallel/sequential strategy
  const results = await fetchServicesWithHybridStrategy(
    servicesToQuery,
    interactive,
  );

  // Collect successful results and errors
  const successes: ServiceUsageData[] = [];
  const errors: { service: string; error: ApiError }[] = [];
  const authFailureServices = new Set<string>();

  for (const { service, result } of results) {
    if (result.ok) {
      successes.push(result.value);
    } else {
      errors.push({ service, error: result.error });
      if (isAuthFailure(result)) authFailureServices.add(service);
    }
  }

  // Display errors if any (but don't exit if we have at least one success)
  if (errors.length > 0) {
    for (const { service, error } of errors) {
      console.error(
        chalk.yellow(`⚠ Warning: Failed to fetch ${service} usage:`),
      );
      console.error(chalk.gray(`  ${error.message}`));
      if (error.status) {
        console.error(chalk.gray(`  Status: ${String(error.status)}`));
      }
    }
    if (successes.length > 0) {
      console.error(); // Empty line for spacing
    }
  }

  if (!interactive && authFailureServices.size > 0) {
    const list = [...authFailureServices].join(", ");
    console.error(
      chalk.gray(
        `Authentication required for: ${list}. ` +
          "For GitHub Copilot, run 'axusage --auth-setup github-copilot --interactive'. " +
          "For CLI-auth services, run the provider CLI (claude/codex/gemini), or re-run with '--interactive' to re-authenticate during fetch.",
      ),
    );
    if (successes.length > 0) {
      console.error();
    }
  }

  // Exit if no services succeeded
  if (successes.length === 0) {
    console.error(chalk.red("\nNo services could be queried successfully."));
    process.exitCode = 1;
    return;
  }

  // Display results
  const hasPartialFailures = errors.length > 0;

  const format: "text" | "tsv" | "json" | "prometheus" =
    options.format ?? "text";

  switch (format) {
    case "tsv": {
      console.log(formatServiceUsageAsTsv(successes));
      break;
    }
    case "json": {
      const [singleSuccess] = successes;

      if (successes.length === 1 && !hasPartialFailures && singleSuccess) {
        console.log(formatServiceUsageDataAsJson(singleSuccess));
      } else {
        const payload =
          successes.length === 1 && singleSuccess
            ? toJsonObject(singleSuccess)
            : successes.map((data) => toJsonObject(data));
        const output = hasPartialFailures
          ? {
              results: payload,
              errors: errors.map(({ service, error }) => ({
                service,
                message: error.message,
                status: error.status,
              })),
            }
          : payload;
        // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null for no replacer
        console.log(JSON.stringify(output, null, 2));
      }
      break;
    }
    case "prometheus": {
      // Emit Prometheus text metrics using prom-client
      const output = await formatPrometheusMetrics(successes);
      process.stdout.write(output);
      break;
    }
    case "text": {
      // For human-readable output, display each service's results
      for (const data of successes) {
        const index = successes.indexOf(data);
        if (index > 0) {
          console.log(); // Add spacing between services
        }
        console.log(formatServiceUsageData(data));
      }
      break;
    }
  }

  if (hasPartialFailures) {
    process.exitCode = 1;
  }
}
