import chalk from "chalk";
import {
  formatServiceUsageData,
  formatServiceUsageDataAsJson,
  toJsonObject,
} from "../utils/format-service-usage.js";
import type { ServiceUsageData, ApiError } from "../types/domain.js";
import type { UsageCommandOptions } from "./fetch-service-usage.js";
import {
  fetchServiceUsage,
  selectServicesToQuery,
} from "./fetch-service-usage.js";

/**
 * Executes the usage command
 */
export async function usageCommand(
  options: UsageCommandOptions,
): Promise<void> {
  const servicesToQuery = selectServicesToQuery(options.service);

  // Fetch usage data from all services in parallel
  const results = await Promise.all(
    servicesToQuery.map(async (serviceName) => ({
      service: serviceName,
      result: await fetchServiceUsage(serviceName),
    })),
  );

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

  if (options.json) {
    const [singleSuccess] = successes;

    if (successes.length === 1 && !hasPartialFailures && singleSuccess) {
      console.log(formatServiceUsageDataAsJson(singleSuccess, options.window));
    } else {
      const payload =
        successes.length === 1 && singleSuccess
          ? toJsonObject(singleSuccess, options.window)
          : successes.map((data) => toJsonObject(data, options.window));
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
