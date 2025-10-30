import chalk from "chalk";
import { getServiceAdapter } from "../services/registry.js";
import {
  formatServiceUsageData,
  formatServiceUsageDataAsJson,
} from "../utils/format-common.js";
import type { ServiceUsageData, Result } from "../types/domain.js";
import { ApiError } from "../types/domain.js";

const ALL_SERVICES = ["claude", "chatgpt", "github-copilot"] as const;
type KnownService = (typeof ALL_SERVICES)[number];

const ENV_VAR_CANDIDATES = {
  claude: ["CLAUDE_ACCESS_TOKEN"],
  chatgpt: ["CHATGPT_ACCESS_TOKEN"],
  "github-copilot": ["GITHUB_COPILOT_SESSION_TOKEN"],
} as const satisfies Record<string, readonly string[]>;

function isKnownService(service: string): service is KnownService {
  return (ALL_SERVICES as readonly string[]).includes(service);
}

function getEnvVarCandidates(service: string): readonly string[] {
  const normalized = service.toLowerCase();
  if (isKnownService(normalized)) {
    return ENV_VAR_CANDIDATES[normalized];
  }
  return [`${service.toUpperCase()}_ACCESS_TOKEN`];
}

type UsageCommandOptions = {
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

  const candidates = getEnvVarCandidates(service);

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
    const candidates = getEnvVarCandidates(serviceName);
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
  const normalizedService = options.service?.toLowerCase();

  let servicesToQuery: string[];
  if (!options.service || normalizedService === "all") {
    servicesToQuery = [...ALL_SERVICES];
  } else {
    servicesToQuery = [options.service];
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
  const hasPartialFailures = errors.length > 0;

  if (options.json) {
    const serialize = (data: ServiceUsageData) =>
      JSON.parse(formatServiceUsageDataAsJson(data, options.window));

    const [singleSuccess] = successes;

    if (successes.length === 1 && !hasPartialFailures && singleSuccess) {
      console.log(formatServiceUsageDataAsJson(singleSuccess, options.window));
    } else {
      const payload =
        successes.length === 1 && singleSuccess
          ? serialize(singleSuccess)
          : successes.map(serialize);
      const output = hasPartialFailures
        ? {
            results: payload,
            errors: errors.map(({ service, error }) => ({
              service,
              message: error.message,
              status: error.status ?? null,
            })),
          }
        : payload;
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
