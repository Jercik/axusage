import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import type { SupportedService } from "../services/supported-service.js";
import type { ApiError, Result, ServiceUsageData } from "../types/domain.js";
import { resolveAuthCliDependencyOrReport } from "../utils/check-cli-dependency.js";
import { chalk } from "../utils/color.js";
import { resolvePromptCapability } from "../utils/resolve-prompt-capability.js";

/** Timeout for authentication setup (5 minutes) */
const AUTH_SETUP_TIMEOUT_MS = 300_000;

/**
 * Check if an error message indicates an authentication issue.
 * Matches common authentication error patterns like "unauthorized", "401",
 * "authentication failed", etc. with word boundaries to avoid false positives.
 *
 * @param message - The error message to check
 * @returns true if the message indicates an authentication error
 *
 * @example
 * isAuthError("401 Unauthorized") // true
 * isAuthError("Network timeout") // false
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
 * Check if a fetch result indicates an authentication failure.
 * Combines the result error check with auth error pattern matching.
 */
export function isAuthFailure(
  result: Result<ServiceUsageData, ApiError>,
): boolean {
  return (
    !result.ok &&
    Boolean(result.error.message) &&
    isAuthError(result.error.message)
  );
}

/**
 * Run auth setup for a service programmatically.
 * Returns true if auth setup completed successfully.
 * Times out after 5 minutes to prevent indefinite hangs.
 *
 * Note: Gemini uses CLI-based auth and cannot use browser-based re-auth.
 * This function prints instructions and returns false for Gemini.
 */
export async function runAuthSetup(
  service: SupportedService,
): Promise<boolean> {
  // CLI-based auth cannot use browser auth flow
  if (service === "gemini") {
    const cliPath = resolveAuthCliDependencyOrReport("gemini");
    if (!cliPath) return false;
    console.error(
      chalk.yellow(
        "\nGemini uses CLI-based authentication managed by the Gemini CLI.",
      ),
    );
    console.error(chalk.gray("\nTo re-authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray(
        "\nThe Gemini CLI will guide you through the OAuth login process.\n",
      ),
    );
    return false;
  }

  if (service === "claude") {
    const cliPath = resolveAuthCliDependencyOrReport("claude");
    if (!cliPath) return false;
    console.error(
      chalk.yellow(
        "\nClaude uses CLI-based authentication managed by Claude Code.",
      ),
    );
    console.error(chalk.gray("\nTo re-authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray("\nClaude Code will guide you through authentication.\n"),
    );
    return false;
  }

  if (service === "chatgpt") {
    const cliPath = resolveAuthCliDependencyOrReport("chatgpt");
    if (!cliPath) return false;
    console.error(
      chalk.yellow("\nChatGPT uses CLI-based authentication managed by Codex."),
    );
    console.error(chalk.gray("\nTo re-authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray("\nCodex will guide you through authentication.\n"),
    );
    return false;
  }

  if (!resolvePromptCapability()) {
    console.error(
      chalk.red("Error: Interactive authentication requires a TTY terminal."),
    );
    console.error(
      chalk.gray(
        "Re-run with --interactive in a terminal to complete authentication.",
      ),
    );
    return false;
  }

  const manager = new BrowserAuthManager({ headless: false });

  let setupPromise: Promise<void> | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    console.error(
      chalk.blue(`\nOpening browser for ${service} authentication...\n`),
    );

    setupPromise = manager.setupAuth(service);
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Authentication setup timed out after 5 minutes"));
      }, AUTH_SETUP_TIMEOUT_MS);
    });

    await Promise.race([setupPromise, timeoutPromise]);

    console.error(
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
    clearTimeout(timeoutId);
    if (setupPromise) {
      // Avoid unhandled rejections if the timeout wins the race.
      void setupPromise.catch(() => {});
    }
    await manager.close();
  }
}
