import { fetchServiceUsage } from "./fetch-service-usage.js";
import { isAuthFailure, runAuthSetup } from "./run-auth-setup.js";
import { validateService } from "../services/supported-service.js";
import type { ServiceResult } from "../types/domain.js";
import { chalk } from "../utils/color.js";

/**
 * Fetch usage for a service, with automatic re-authentication on auth errors.
 * Prompts the user to re-authenticate if the initial fetch fails with an auth error,
 * then retries the fetch. Returns the original result if re-authentication fails.
 */
export async function fetchServiceUsageWithAutoReauth(
  serviceName: string,
  interactive: boolean,
): Promise<ServiceResult> {
  const result = await fetchServiceUsage(serviceName);

  if (!interactive) {
    return { service: serviceName, result };
  }

  // If auth error, try to re-authenticate and retry
  if (isAuthFailure(result)) {
    console.error(
      chalk.yellow(
        `⚠ Authentication failed for ${serviceName}. Attempting to re-authenticate...`,
      ),
    );

    try {
      const service = validateService(serviceName);
      const authSuccess = await runAuthSetup(service);

      if (authSuccess) {
        if (process.stderr.isTTY) {
          console.error(chalk.blue(`Retrying ${serviceName} usage fetch...\n`));
        }
        const retryResult = await fetchServiceUsage(serviceName);
        return { service: serviceName, result: retryResult };
      } else {
        console.error(
          chalk.red(`Re-authentication failed for ${serviceName}.`),
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Distinguish validation errors from auth setup errors
      const isValidationError =
        errorMessage.includes("Unsupported service") ||
        errorMessage.includes("Service is required");
      const prefix = isValidationError
        ? "Invalid service"
        : "Failed to re-authenticate";
      console.error(chalk.red(`${prefix}: ${errorMessage}`));
    }
  }

  // Return original result if re-authentication failed or was not attempted
  return { service: serviceName, result };
}
