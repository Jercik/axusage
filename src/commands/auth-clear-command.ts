import { confirm } from "@inquirer/prompts";
import { existsSync } from "node:fs";
import trash from "trash";
import { validateService } from "../services/supported-service.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "../services/auth-storage-path.js";
import { getBrowserContextsDirectory } from "../services/app-paths.js";
import { chalk } from "../utils/color.js";

type AuthClearOptions = {
  readonly service?: string;
  readonly interactive?: boolean;
  readonly force?: boolean;
};

function canPrompt(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

export async function authClearCommand(
  options: AuthClearOptions,
): Promise<void> {
  const service = validateService(options.service);
  const dataDirectory = getBrowserContextsDirectory();
  const storage = getStorageStatePathFor(dataDirectory, service);
  const meta = getAuthMetaPathFor(dataDirectory, service);
  try {
    const targets = [storage, meta].filter((p) => existsSync(p));
    if (targets.length === 0) {
      console.error(
        chalk.gray(`\nNo saved authentication found for ${service}.`),
      );
      return;
    }

    if (!options.force) {
      if (!options.interactive) {
        console.error(
          chalk.red(
            "Error: Clearing saved authentication requires confirmation.",
          ),
        );
        console.error(
          chalk.gray(
            "Re-run with --interactive to confirm, or use --force to skip confirmation.",
          ),
        );
        console.error(chalk.gray("Try 'axusage --help' for details."));
        process.exitCode = 1;
        return;
      }

      if (!canPrompt()) {
        console.error(
          chalk.red("Error: --interactive requires a TTY-enabled terminal."),
        );
        console.error(
          chalk.gray("Re-run in a terminal or pass --force instead."),
        );
        console.error(chalk.gray("Try 'axusage --help' for details."));
        process.exitCode = 1;
        return;
      }

      const confirmed = await confirm({
        message: `Remove saved authentication for ${service}?`,
        default: false,
      });
      if (!confirmed) {
        console.error(chalk.gray("Aborted."));
        return;
      }
    }

    await trash(targets, { glob: false });
    console.error(chalk.green(`\n✓ Cleared authentication for ${service}`));
  } catch (error) {
    console.error(
      chalk.red(
        `\n✗ Failed to clear authentication for ${service}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exitCode = 1;
  }
}
