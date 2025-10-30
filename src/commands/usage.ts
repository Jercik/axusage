import chalk from "chalk";
import { getServiceAdapter } from "#services/registry";
import {
  formatServiceUsageData,
  formatServiceUsageDataAsJson,
} from "#utils/format-common";
import type { ServiceUsageData, Result } from "#types/domain";
import { ApiError } from "#types/domain";

export type UsageCommandOptions = {
  readonly service?: string;
  readonly token?: string;
  readonly json?: boolean;
  readonly window?: string;
};

/**
 * Gets the access token for a specific service
 */
function getAccessToken(
  service: string,
  options: UsageCommandOptions,
): string | undefined {
  if (options.token) {
    return options.token;
  }

  // Environment variable candidates by service
  const envVarCandidates: Record<string, readonly string[]> = {
    claude: ["CLAUDE_ACCESS_TOKEN"],
    chatgpt: ["CHATGPT_ACCESS_TOKEN"],
    "github-copilot": ["GITHUB_COPILOT_SESSION_TOKEN"],
  } as const;

  const candidates =
    envVarCandidates[service.toLowerCase()] ??
    ([`${service.toUpperCase()}_ACCESS_TOKEN`] as const);

  for (const name of candidates) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/**
 * Fetches usage data for a single service
 */
async function fetchServiceUsage(
  serviceName: string,
  options: UsageCommandOptions,
): Promise<Result<ServiceUsageData, ApiError>> {
  const adapter = getServiceAdapter(serviceName);

  if (!adapter) {
    return {
      ok: false,
      error: new ApiError(`Unknown service "${serviceName}"`),
    };
  }

  const accessToken = getAccessToken(serviceName, options);

  if (!accessToken) {
    const envVarCandidates: Record<string, readonly string[]> = {
      claude: ["CLAUDE_ACCESS_TOKEN"],
      chatgpt: ["CHATGPT_ACCESS_TOKEN"],
      "github-copilot": ["GITHUB_COPILOT_SESSION_TOKEN"],
    } as const;
    const candidates =
      envVarCandidates[serviceName.toLowerCase()] ??
      ([`${serviceName.toUpperCase()}_ACCESS_TOKEN`] as const);
    const display = candidates.join(" or ");
    return {
      ok: false,
      error: new ApiError(`${display} is not set`),
    };
  }

  return await adapter.fetchUsage({
    accessToken,
  });
}

/**
 * Executes the usage command
 */
export async function usageCommand(
  options: UsageCommandOptions,
): Promise<void> {
  // Default to all three services when no specific service is provided
  const servicesToQuery = options.service
    ? [options.service]
    : ["claude", "chatgpt", "github-copilot"];

  // Special handling for "all" keyword
  if (options.service === "all") {
    servicesToQuery.length = 0;
    servicesToQuery.push("claude", "chatgpt", "github-copilot");
  }

  // Fetch usage data from all services in parallel
  const results = await Promise.all(
    servicesToQuery.map(async (serviceName) => ({
      service: serviceName,
      result: await fetchServiceUsage(serviceName, options),
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
    process.exit(1);
  }

  // Display results
  if (options.json) {
    // For JSON output, return an array if multiple services, single object if one
    if (successes.length === 1) {
      const firstSuccess = successes[0];
      if (firstSuccess) {
        console.log(formatServiceUsageDataAsJson(firstSuccess, options.window));
      }
    } else {
      const jsonResults = successes.map((data) => {
        const parsed = JSON.parse(
          formatServiceUsageDataAsJson(data, options.window),
        );
        return parsed;
      });
      console.log(JSON.stringify(jsonResults, null, 2));
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
}
