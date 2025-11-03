import chalk from "chalk";
import { existsSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import { getStorageStatePathFor } from "../services/auth-storage-path.js";

type AuthStatusOptions = { readonly service?: string };

export async function authStatusCommand(
  options: AuthStatusOptions,
): Promise<void> {
  // Keep async signature for command consistency
  await Promise.resolve();
  const servicesToCheck = options.service
    ? [validateService(options.service)]
    : SUPPORTED_SERVICES;

  const dataDirectory = path.join(
    homedir(),
    ".agent-usage",
    "browser-contexts",
  );

  console.log(chalk.blue("\nAuthentication Status:\n"));

  for (const service of servicesToCheck) {
    const storagePath = getStorageStatePathFor(dataDirectory, service);
    const hasAuth = existsSync(storagePath);
    const status = hasAuth
      ? chalk.green("✓ Authenticated")
      : chalk.gray("✗ Not authenticated");
    console.log(`${chalk.bold(service)}: ${status}`);
  }

  const allAuthenticated = servicesToCheck.every((s) =>
    existsSync(getStorageStatePathFor(dataDirectory, s)),
  );
  if (!allAuthenticated) {
    console.log(
      chalk.gray(
        `\nTo set up authentication, run: ${chalk.cyan("agent-usage auth setup <service>")}`,
      ),
    );
  }
}
