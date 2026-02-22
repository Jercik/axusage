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
import { isAuthFailure } from "./run-auth-setup.js";
import { chalk } from "../utils/color.js";

/**
 * Fetches usage for all requested services in parallel.
 */
export async function fetchServicesInParallel(
  servicesToQuery: string[],
): Promise<ServiceResult[]> {
  return await Promise.all(
    servicesToQuery.map(async (serviceName): Promise<ServiceResult> => {
      const result = await fetchServiceUsage(serviceName);
      return { service: serviceName, result };
    }),
  );
}

/**
 * Executes the usage command
 */
export async function usageCommand(
  options: UsageCommandOptions,
): Promise<void> {
  const servicesToQuery = selectServicesToQuery(options.service);
  const results = await fetchServicesInParallel(servicesToQuery);

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

  if (authFailureServices.size > 0) {
    const list = [...authFailureServices].join(", ");
    console.error(
      chalk.gray(
        `Authentication required for: ${list}. ` +
          "Run 'axusage --auth-setup <service>' for setup instructions, " +
          "or authenticate directly with provider CLIs (claude/codex/gemini/gh auth login).",
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
