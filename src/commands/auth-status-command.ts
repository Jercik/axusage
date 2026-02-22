import { checkAuth } from "axauth";

import {
  SUPPORTED_SERVICES,
  validateService,
} from "../services/supported-service.js";
import { getCopilotTokenFromCustomGhPath } from "../utils/copilot-gh-token.js";
import { chalk } from "../utils/color.js";

type AuthStatusOptions = { readonly service?: string };

export function authStatusCommand(options: AuthStatusOptions): void {
  const servicesToCheck = options.service
    ? [validateService(options.service)]
    : SUPPORTED_SERVICES;

  let hasFailures = false;

  console.log(chalk.blue("\nAuthentication Status:\n"));

  for (const service of servicesToCheck) {
    let result = checkAuth(service);

    if (service === "copilot" && !result.authenticated) {
      const tokenFromOverride = getCopilotTokenFromCustomGhPath();
      if (tokenFromOverride) {
        result = {
          ...result,
          authenticated: true,
          method: "GitHub CLI (AXUSAGE_GH_PATH)",
        };
      }
    }

    const status = result.authenticated
      ? chalk.green("✓ authenticated")
      : chalk.red("✗ not authenticated");

    if (!result.authenticated) {
      hasFailures = true;
    }

    console.log(`${chalk.bold(service)}: ${status}`);
    if (result.method) {
      console.log(`  ${chalk.dim("Method:")} ${chalk.dim(result.method)}`);
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
  }
}
