import chalk from "chalk";
import { fetchServiceUsage } from "./fetch-service-usage.js";
import { isAuthError, runAuthSetup } from "./run-auth-setup.js";
import { validateService } from "../services/supported-service.js";
import type { ServiceResult } from "../types/domain.js";

/**
 * Fetch usage for a service, with automatic re-authentication on auth errors.
 * Prompts the user to re-authenticate if the initial fetch fails with an auth error,
 * then retries the fetch. Returns the original result if re-authentication fails.
 */
export async function fetchServiceUsageWithAutoReauth(
  serviceName: string,
): Promise<ServiceResult> {
  const result = await fetchServiceUsage(serviceName);

  // If auth error, try to re-authenticate and retry
  if (!result.ok && isAuthError(result.error.message)) {
    console.error(
      chalk.yellow(
        `⚠ Authentication failed for ${serviceName}. Opening browser to re-authenticate...`,
      ),
    );

    try {
      const service = validateService(serviceName);
      const authSuccess = await runAuthSetup(service);

      if (authSuccess) {
        console.log(chalk.blue(`Retrying ${serviceName} usage fetch...\n`));
        const retryResult = await fetchServiceUsage(serviceName);
        return { service: serviceName, result: retryResult };
      } else {
        console.error(
          chalk.red(`Re-authentication failed for ${serviceName}.`),
        );
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to re-authenticate: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  return { service: serviceName, result };
}
