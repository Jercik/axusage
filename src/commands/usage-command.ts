import chalk from "chalk";
import {
  formatServiceUsageData,
  formatServiceUsageDataAsJson,
  toJsonObject,
} from "../utils/format-service-usage.js";
import { formatPrometheusMetrics } from "../utils/format-prometheus-metrics.js";
import type { ServiceUsageData, ApiError, Result } from "../types/domain.js";
import type { UsageCommandOptions } from "./fetch-service-usage.js";
import {
  fetchServiceUsage,
  selectServicesToQuery,
} from "./fetch-service-usage.js";
import { fetchServiceUsageWithAutoReauth } from "./fetch-service-usage-with-reauth.js";
import { isAuthError } from "./run-auth-setup.js";

type ServiceResult = {
  service: string;
  result: Result<ServiceUsageData, ApiError>;
};

/**
 * Fetches usage for services using hybrid strategy:
 * 1. Try all services in parallel first
 * 2. If any service fails with auth error, retry those sequentially with re-auth
 */
async function fetchServicesWithHybridStrategy(
  servicesToQuery: string[],
): Promise<ServiceResult[]> {
  // First attempt: fetch all services in parallel
  const parallelResults = await Promise.all(
    servicesToQuery.map(async (serviceName): Promise<ServiceResult> => {
      const result = await fetchServiceUsage(serviceName);
      return { service: serviceName, result };
    }),
  );

  // Check for auth errors
  const authFailures = parallelResults.filter(
    ({ result }) => !result.ok && isAuthError(result.error.message),
  );

  // If no auth failures, return parallel results
  if (authFailures.length === 0) {
    return parallelResults;
  }

  // Retry auth failures sequentially with re-authentication
  const retryResults: ServiceResult[] = [];
  for (const { service } of authFailures) {
    const result = await fetchServiceUsageWithAutoReauth(service);
    retryResults.push(result);
  }

  // Merge results: keep successful parallel results, replace auth failures with retries
  const authFailureServices = new Set(authFailures.map((f) => f.service));
  return parallelResults.map((parallelResult) =>
    authFailureServices.has(parallelResult.service)
      ? (retryResults.find((r) => r.service === parallelResult.service) ??
        parallelResult)
      : parallelResult,
  );
}

/**
 * Executes the usage command
 */
export async function usageCommand(
  options: UsageCommandOptions,
): Promise<void> {
  const servicesToQuery = selectServicesToQuery(options.service);

  // Fetch usage data using hybrid parallel/sequential strategy
  const results = await fetchServicesWithHybridStrategy(servicesToQuery);

  // Collect successful results and errors
  const successes: ServiceUsageData[] = [];
  const errors: { service: string; error: ApiError }[] = [];

  for (const { service, result } of results) {
    if (result.ok) {
      successes.push(result.value);
    } else {
      errors.push({ service, error: result.error });
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

  // Exit if no services succeeded
  if (successes.length === 0) {
    console.error(chalk.red("\nNo services could be queried successfully."));
    throw new Error("No services could be queried successfully.");
  }

  // Display results
  const hasPartialFailures = errors.length > 0;

  const format: "text" | "json" | "prometheus" = options.format ?? "text";

  if (format === "json") {
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
  } else if (format === "prometheus") {
    // Emit Prometheus text metrics using prom-client
    const output = await formatPrometheusMetrics(successes);
    process.stdout.write(output);
  } else {
    // For human-readable output, display each service's results
    for (const data of successes) {
      const index = successes.indexOf(data);
      if (index > 0) {
        console.log(); // Add spacing between services
      }
      console.log(formatServiceUsageData(data));
    }
  }

  if (hasPartialFailures) {
    process.exitCode = 2;
  }
}
