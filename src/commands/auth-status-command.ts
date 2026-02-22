import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import type { AuthCliService } from "../utils/check-cli-dependency.js";
import {
  AUTH_CLI_SERVICES,
  checkCliDependency,
  getAuthCliDependency,
} from "../utils/check-cli-dependency.js";
import { chalk } from "../utils/color.js";

type AuthStatusOptions = { readonly service?: string };

export function authStatusCommand(options: AuthStatusOptions): void {
  const servicesToCheck = options.service
    ? [validateService(options.service)]
    : SUPPORTED_SERVICES;

  const cliAuthServices = new Set(AUTH_CLI_SERVICES);
  let hasFailures = false;

  console.log(chalk.blue("\nAuthentication Status:\n"));

  for (const service of servicesToCheck) {
    if (cliAuthServices.has(service)) {
      const dependency = getAuthCliDependency(service as AuthCliService);
      const result = checkCliDependency(dependency);
      const status = result.ok
        ? chalk.green("↪ CLI-managed")
        : chalk.red("✗ CLI missing");
      if (!result.ok) {
        hasFailures = true;
      }
      console.log(`${chalk.bold(service)}: ${status}`);
      console.log(`  ${chalk.dim("CLI:")} ${chalk.dim(result.path)}`);
      if (result.ok) {
        console.log(
          `  ${chalk.dim("Auth:")} ${chalk.dim(`run ${result.path} to check/login`)}`,
        );
      } else {
        console.log(
          `  ${chalk.dim("Install:")} ${chalk.dim(dependency.installHint)}`,
        );
        console.log(
          `  ${chalk.dim("Override:")} ${chalk.dim(`${dependency.envVar}=/path/to/${dependency.command}`)}`,
        );
      }
      continue;
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}
