import chalk from "chalk";
import { rm } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { validateService } from "../services/supported-service.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "../services/auth-storage-path.js";

type AuthClearOptions = { readonly service?: string };

export async function authClearCommand(
  options: AuthClearOptions,
): Promise<void> {
  const service = validateService(options.service);
  const dataDirectory = path.join(
    homedir(),
    ".agent-usage",
    "browser-contexts",
  );
  const storage = getStorageStatePathFor(dataDirectory, service);
  const meta = getAuthMetaPathFor(dataDirectory, service);
  try {
    await rm(storage, { force: true });
    await rm(meta, { force: true });
    console.log(chalk.green(`\n✓ Cleared authentication for ${service}`));
  } catch (error) {
    console.error(
      chalk.red(
        `\n✗ Failed to clear authentication for ${service}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exitCode = 1;
  }
}
