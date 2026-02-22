import type { SupportedService } from "../services/supported-service.js";
import { validateService } from "../services/supported-service.js";
import { resolveAuthCliDependencyOrReport } from "../utils/check-cli-dependency.js";
import { chalk } from "../utils/color.js";

/**
 * Options for the auth setup command
 */
type AuthSetupOptions = {
  readonly service?: string;
};

function printCliAuthInstructions(
  service: SupportedService,
  cliPath: string,
): void {
  switch (service) {
    case "gemini": {
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
      break;
    }
    case "claude": {
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
      break;
    }
    case "codex": {
      console.error(
        chalk.yellow(
          "\nChatGPT uses CLI-based authentication managed by Codex.",
        ),
      );
      console.error(chalk.gray("\nTo authenticate, run:"));
      console.error(chalk.cyan(`  ${cliPath}`));
      console.error(
        chalk.gray("\nCodex will guide you through authentication.\n"),
      );
      break;
    }
    case "copilot": {
      console.error(
        chalk.yellow(
          "\nGitHub Copilot uses CLI-based authentication managed by the GitHub CLI.",
        ),
      );
      console.error(chalk.gray("\nTo authenticate, run:"));
      console.error(chalk.cyan(`  ${cliPath} auth login`));
      console.error(
        chalk.gray(
          "\nThe GitHub CLI will guide you through the OAuth login process.\n",
        ),
      );
      break;
    }
  }
}

/**
 * Set up authentication for a service
 */
export function authSetupCommand(options: AuthSetupOptions): void {
  const service = validateService(options.service);

  const cliPath = resolveAuthCliDependencyOrReport(service, {
    setExitCode: true,
  });
  if (!cliPath) return;

  printCliAuthInstructions(service, cliPath);
}
