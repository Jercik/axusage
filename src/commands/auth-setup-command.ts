import chalk from "chalk";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import { validateService } from "../services/supported-service.js";

/**
 * Options for the auth setup command
 */
type AuthSetupOptions = {
  readonly service?: string;
};

/**
 * Set up authentication for a service
 */
export async function authSetupCommand(
  options: AuthSetupOptions,
): Promise<void> {
  const service = validateService(options.service);

  // Gemini uses CLI-based auth - users should run `gemini` directly
  if (service === "gemini") {
    console.error(
      chalk.yellow(
        "\nGemini uses CLI-based authentication managed by the Gemini CLI.",
      ),
    );
    console.error(chalk.gray("\nTo authenticate, run:"));
    console.error(chalk.cyan("  gemini"));
    console.error(
      chalk.gray(
        "\nThe Gemini CLI will guide you through the OAuth login process.\n",
      ),
    );
    return;
  }

  const manager = new BrowserAuthManager({ headless: false });

  try {
    console.error(
      chalk.blue(`\nSetting up authentication for ${service}...\n`),
    );

    await manager.setupAuth(service);

    console.error(
      chalk.green(`\n✓ Authentication for ${service} is complete!`),
    );
    console.error(
      chalk.gray(
        `\nYou can now run: ${chalk.cyan(`agent-usage usage --service ${service}`)}`,
      ),
    );
  } catch (error) {
    console.error(
      chalk.red(
        `\n✗ Failed to set up authentication for ${service}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exitCode = 1;
  } finally {
    await manager.close();
  }
}
