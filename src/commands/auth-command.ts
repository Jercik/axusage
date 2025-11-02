import chalk from "chalk";
import {
  BrowserAuthManager,
  type SupportedService,
} from "../services/browser-auth-manager.js";

/**
 * Options for the auth setup command
 */
export type AuthSetupOptions = {
  readonly service?: string;
};

/**
 * Options for the auth status command
 */
export type AuthStatusOptions = {
  readonly service?: string;
};

const SUPPORTED_SERVICES: SupportedService[] = [
  "claude",
  "chatgpt",
  "github-copilot",
];

/**
 * Validate and get service name
 */
function validateService(service: string | undefined): SupportedService {
  if (!service) {
    throw new Error(
      `Service is required. Supported services: ${SUPPORTED_SERVICES.join(", ")}`,
    );
  }

  const normalizedService = service.toLowerCase();
  if (!SUPPORTED_SERVICES.includes(normalizedService as SupportedService)) {
    throw new Error(
      `Unsupported service: ${service}. Supported services: ${SUPPORTED_SERVICES.join(", ")}`,
    );
  }

  return normalizedService as SupportedService;
}

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
    throw error;
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
