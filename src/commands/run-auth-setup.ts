import chalk from "chalk";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import type { SupportedService } from "../services/supported-service.js";

/**
 * Check if an error message indicates an authentication issue.
 */
export function isAuthError(message: string): boolean {
  const authPatterns = [
    /authentication failed/iu,
    /no saved authentication/iu,
    /\b401\b/u,
    /unauthorized/iu,
    /session expired/iu,
    /login required/iu,
  ];
  return authPatterns.some((pattern) => pattern.test(message));
}

/**
 * Run auth setup for a service programmatically.
 * Returns true if auth setup completed successfully.
 */
export async function runAuthSetup(
  service: SupportedService,
): Promise<boolean> {
  const manager = new BrowserAuthManager({ headless: false });

  try {
    console.log(
      chalk.blue(`\nOpening browser for ${service} authentication...\n`),
    );
    await manager.setupAuth(service);
    console.log(
      chalk.green(`\n✓ Authentication for ${service} is complete!\n`),
    );
    return true;
  } catch (error) {
    console.error(
      chalk.red(
        `\n✗ Failed to set up authentication: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return false;
  } finally {
    await manager.close();
  }
}
