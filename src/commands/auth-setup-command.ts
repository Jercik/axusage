import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import { validateService } from "../services/supported-service.js";
import type {
  AuthCliService,
  CliDependency,
} from "../utils/check-cli-dependency.js";
import {
  checkCliDependency,
  getAuthCliDependency,
} from "../utils/check-cli-dependency.js";
import { chalk } from "../utils/color.js";

/**
 * Options for the auth setup command
 */
type AuthSetupOptions = {
  readonly service?: string;
  readonly interactive?: boolean;
};

/**
 * Set up authentication for a service
 */
export async function authSetupCommand(
  options: AuthSetupOptions,
): Promise<void> {
  const service = validateService(options.service);

  const ensureCliDependency = (
    cliService: AuthCliService,
  ): string | undefined => {
    const dependency = getAuthCliDependency(cliService);
    const result = checkCliDependency(dependency);
    if (!result.ok) {
      reportMissingCliDependency(dependency, result.path);
      process.exitCode = 1;
      return undefined;
    }
    return result.path;
  };

  // CLI-based auth - users should run the native CLI directly
  if (service === "gemini") {
    const cliPath = ensureCliDependency("gemini");
    if (!cliPath) return;
    console.error(
      chalk.yellow(
        "\nGemini uses CLI-based authentication managed by the Gemini CLI.",
      ),
    );
    console.error(chalk.gray("\nTo authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray(
        "\nThe Gemini CLI will guide you through the OAuth login process.\n",
      ),
    );
    return;
  }

  if (service === "claude") {
    const cliPath = ensureCliDependency("claude");
    if (!cliPath) return;
    console.error(
      chalk.yellow(
        "\nClaude uses CLI-based authentication managed by Claude Code.",
      ),
    );
    console.error(chalk.gray("\nTo authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray("\nClaude Code will guide you through authentication.\n"),
    );
    return;
  }

  if (service === "chatgpt") {
    const cliPath = ensureCliDependency("chatgpt");
    if (!cliPath) return;
    console.error(
      chalk.yellow("\nChatGPT uses CLI-based authentication managed by Codex."),
    );
    console.error(chalk.gray("\nTo authenticate, run:"));
    console.error(chalk.cyan(`  ${cliPath}`));
    console.error(
      chalk.gray("\nCodex will guide you through authentication.\n"),
    );
    return;
  }

  if (!options.interactive) {
    console.error(
      chalk.red("Error: Authentication setup requires --interactive."),
    );
    console.error(
      chalk.gray(
        "Re-run with --interactive in a TTY-enabled terminal to continue.",
      ),
    );
    console.error(chalk.gray("Try 'axusage --help' for details."));
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      chalk.red("Error: --interactive requires a TTY-enabled terminal."),
    );
    console.error(
      chalk.gray("Re-run in a terminal session to complete authentication."),
    );
    console.error(chalk.gray("Try 'axusage --help' for details."));
    process.exitCode = 1;
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
        `\nYou can now run: ${chalk.cyan(`axusage --service ${service}`)}`,
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

function reportMissingCliDependency(
  dependency: CliDependency,
  path: string,
): void {
  console.error(
    chalk.red(`Error: Required dependency '${dependency.command}' not found.`),
  );
  console.error(chalk.gray(`Looked for: ${path}`));
  console.error(chalk.gray("\nTo fix, either:"));
  console.error(chalk.gray(`  1. Install it: ${dependency.installHint}`));
  console.error(
    chalk.gray(`  2. Set ${dependency.envVar}=/path/to/${dependency.command}`),
  );
  console.error(chalk.gray("Try 'axusage --help' for requirements."));
}
