import chalk from "chalk";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import { rm } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "../services/auth-storage-path.js";

/**
 * Options for the auth setup command
 */
type AuthSetupOptions = {
  readonly service?: string;
};

/**
 * Options for the auth status command
 */
type AuthStatusOptions = {
  readonly service?: string;
};

/**
 * Options for the auth clear command
 */
type AuthClearOptions = {
  readonly service?: string;
};

// Supported services and validation are provided by supported-service module

/**
 * Set up authentication for a service
 */
export async function authSetupCommand(
  options: AuthSetupOptions,
): Promise<void> {
  const service = validateService(options.service);
  const manager = new BrowserAuthManager({ headless: false });

  try {
    console.log(chalk.blue(`\nSetting up authentication for ${service}...\n`));

    await manager.setupAuth(service);

    console.log(chalk.green(`\n✓ Authentication for ${service} is complete!`));
    console.log(
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
    return;
  } finally {
    await manager.close();
  }
}

/**
 * Check authentication status for services
 */
export async function authStatusCommand(
  options: AuthStatusOptions,
): Promise<void> {
  const manager = new BrowserAuthManager();

  try {
    const servicesToCheck = options.service
      ? [validateService(options.service)]
      : SUPPORTED_SERVICES;

    console.log(chalk.blue("\nAuthentication Status:\n"));

    for (const service of servicesToCheck) {
      const hasAuth = manager.hasAuth(service);
      const status = hasAuth
        ? chalk.green("✓ Authenticated")
        : chalk.gray("✗ Not authenticated");
      console.log(`${chalk.bold(service)}: ${status}`);
    }

    const allAuthenticated = servicesToCheck.every((s) => manager.hasAuth(s));
    if (!allAuthenticated) {
      console.log(
        chalk.gray(
          `\nTo set up authentication, run: ${chalk.cyan("agent-usage auth setup <service>")}`,
        ),
      );
    }
  } finally {
    await manager.close();
  }
}

/**
 * Clear saved authentication for a service
 */
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
