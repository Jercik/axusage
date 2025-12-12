import chalk from "chalk";
import { existsSync } from "node:fs";
import trash from "trash";
import { validateService } from "../services/supported-service.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "../services/auth-storage-path.js";
import { getBrowserContextsDirectory } from "../services/app-paths.js";

type AuthClearOptions = { readonly service?: string };

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
