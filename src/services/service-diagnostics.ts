import { checkAuth } from "axauth";

import {
  checkCliDependency,
  getAuthCliDependency,
} from "../utils/check-cli-dependency.js";
import { getCopilotTokenFromCustomGhPath } from "../utils/copilot-gh-token.js";
import { SUPPORTED_SERVICES } from "./supported-service.js";
import type { SupportedService } from "./supported-service.js";

type ServiceDiagnostic = {
  readonly service: SupportedService;
  readonly cliAvailable: boolean;
  readonly cliPath: string;
  readonly authenticated: boolean;
  readonly authMethod: string | undefined;
};

export type { ServiceDiagnostic };

export function getServiceDiagnostic(
  service: SupportedService,
): ServiceDiagnostic {
  const dependency = getAuthCliDependency(service);
  const cliResult = checkCliDependency(dependency);

  let authResult = checkAuth(service);
  if (service === "copilot" && !authResult.authenticated) {
    const tokenFromOverride = getCopilotTokenFromCustomGhPath();
    if (tokenFromOverride) {
      authResult = {
        ...authResult,
        authenticated: true,
        method: "GitHub CLI (AXUSAGE_GH_PATH)",
      };
    }
  }

  return {
    service,
    cliAvailable: cliResult.ok,
    cliPath: cliResult.path,
    authenticated: authResult.authenticated,
    authMethod: authResult.method,
  };
}

export function getAllServiceDiagnostics(): ServiceDiagnostic[] {
  return SUPPORTED_SERVICES.map((service) => getServiceDiagnostic(service));
}
