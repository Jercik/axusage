import chalk from "chalk";
import { fetchServiceUsage } from "./fetch-service-usage.js";
import { isAuthError, runAuthSetup } from "./run-auth-setup.js";
import { validateService } from "../services/supported-service.js";

/**
 * Fetch usage for a service, with automatic re-authentication on auth errors.
 */
export async function fetchWithAutoReauth(serviceName: string): Promise<{
  service: string;
  result: Awaited<ReturnType<typeof fetchServiceUsage>>;
}> {
  const result = await fetchServiceUsage(serviceName);

  // If auth error, try to re-authenticate and retry
  if (!result.ok && isAuthError(result.error.message)) {
    console.error(
      chalk.yellow(
        `⚠ Authentication failed for ${serviceName}. Opening browser to re-authenticate...`,
      ),
    );

    const service = validateService(serviceName);
    const authSuccess = await runAuthSetup(service);

    if (authSuccess) {
      console.log(chalk.blue(`Retrying ${serviceName} usage fetch...\n`));
      const retryResult = await fetchServiceUsage(serviceName);
      return { service: serviceName, result: retryResult };
    }
  }

  return { service: serviceName, result };
}
