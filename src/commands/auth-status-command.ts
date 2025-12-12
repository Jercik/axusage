import chalk from "chalk";
import { existsSync } from "node:fs";
import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import { getStorageStatePathFor } from "../services/auth-storage-path.js";
import { getBrowserContextsDirectory } from "../services/app-paths.js";

type AuthStatusOptions = { readonly service?: string };

export function authStatusCommand(options: AuthStatusOptions): void {
  const servicesToCheck = options.service
    ? [validateService(options.service)]
    : SUPPORTED_SERVICES;

  const dataDirectory = getBrowserContextsDirectory();

  console.log(chalk.blue("\nAuthentication Status:\n"));

  for (const service of servicesToCheck) {
    const storagePath = getStorageStatePathFor(dataDirectory, service);
    const hasAuth = existsSync(storagePath);
    const status = hasAuth
      ? chalk.green("✓ Authenticated")
      : chalk.gray("✗ Not authenticated");
    console.log(`${chalk.bold(service)}: ${status}`);
    console.log(`  ${chalk.dim("Storage:")} ${chalk.dim(storagePath)}`);
  }

  const allAuthenticated = servicesToCheck.every((s) =>
    existsSync(getStorageStatePathFor(dataDirectory, s)),
  );
  if (!allAuthenticated) {
    console.error(
      chalk.gray(
        `\nTo set up authentication, run: ${chalk.cyan("agent-usage auth setup <service>")}`,
      ),
    );
  }
}
