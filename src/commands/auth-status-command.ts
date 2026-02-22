import { getServiceDiagnostic } from "../services/service-diagnostics.js";
import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import { chalk } from "../utils/color.js";

type AuthStatusOptions = { readonly service?: string };

export function authStatusCommand(options: AuthStatusOptions): void {
  const servicesToCheck = options.service
    ? [validateService(options.service)]
    : SUPPORTED_SERVICES;

  let hasFailures = false;

  console.log(chalk.blue("\nAuthentication Status:\n"));

  for (const service of servicesToCheck) {
    const diagnostic = getServiceDiagnostic(service);

    const status = diagnostic.authenticated
      ? chalk.green("✓ authenticated")
      : chalk.red("✗ not authenticated");

    if (!diagnostic.authenticated) {
      hasFailures = true;
    }

    console.log(`${chalk.bold(service)}: ${status}`);
    if (diagnostic.authMethod) {
      console.log(
        `  ${chalk.dim("Method:")} ${chalk.dim(diagnostic.authMethod)}`,
      );
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}
