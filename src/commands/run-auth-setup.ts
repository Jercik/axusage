import chalk from "chalk";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import type { SupportedService } from "../services/supported-service.js";

/** Timeout for authentication setup (5 minutes) */
const AUTH_SETUP_TIMEOUT_MS = 300_000;

/**
 * Check if an error message indicates an authentication issue.
 * Matches common authentication error patterns like "unauthorized", "401",
 * "authentication failed", etc. with word boundaries to avoid false positives.
 */
export function isAuthError(message: string): boolean {
  const authPatterns = [
    /\bauthentication\s+failed\b/iu,
    /\bno\s+saved\s+authentication\b/iu,
    /\b401\b/u,
    /\bunauthorized\b/iu,
    /\bsession\s+expired\b/iu,
    /\blogin\s+required\b/iu,
    /\bcredentials?\s+(expired|invalid)\b/iu,
  ];
  return authPatterns.some((pattern) => pattern.test(message));
}

/**
 * Run auth setup for a service programmatically.
 * Returns true if auth setup completed successfully.
 * Times out after 5 minutes to prevent indefinite hangs.
 */
export async function runAuthSetup(
  service: SupportedService,
): Promise<boolean> {
  const manager = new BrowserAuthManager({ headless: false });

  try {
    console.log(
      chalk.blue(`\nOpening browser for ${service} authentication...\n`),
    );

    const setupPromise = manager.setupAuth(service);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Authentication setup timed out after 5 minutes"));
      }, AUTH_SETUP_TIMEOUT_MS);
    });

    await Promise.race([setupPromise, timeoutPromise]);

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
