import { checkAuth } from "axauth";

import {
  SUPPORTED_SERVICES,
  type SupportedService,
} from "../services/supported-service.js";
import {
  checkCliDependency,
  getAuthCliDependency,
} from "./check-cli-dependency.js";
import { getCopilotTokenFromCustomGhPath } from "./copilot-gh-token.js";

type RequirementStatus = "ok" | "missing" | "not-authorized";

type RuntimeRequirement = {
  readonly label: string;
  readonly status: RequirementStatus;
  readonly fix: string | undefined;
};

export type { RuntimeRequirement };

const SERVICE_LABELS: Record<SupportedService, string> = {
  claude: "claude",
  codex: "codex (ChatGPT)",
  gemini: "gemini",
  copilot: "gh (Copilot)",
};

const AUTH_FIX_COMMANDS: Record<SupportedService, string> = {
  claude: "Run: claude",
  codex: "Run: codex",
  gemini: "Run: gemini",
  copilot: "Run: gh auth login",
};

function checkServiceRequirement(
  service: SupportedService,
): RuntimeRequirement {
  const label = SERVICE_LABELS[service];
  const dependency = getAuthCliDependency(service);
  const cliResult = checkCliDependency(dependency);

  if (!cliResult.ok) {
    return {
      label,
      status: "missing",
      fix:
        `Install: ${dependency.installHint}. ` +
        `Or set ${dependency.envVar}=/path/to/${dependency.command}`,
    };
  }

  let authResult = checkAuth(service);
  if (service === "copilot" && !authResult.authenticated) {
    const tokenFromOverride = getCopilotTokenFromCustomGhPath();
    if (tokenFromOverride) {
      authResult = { ...authResult, authenticated: true };
    }
  }

  if (!authResult.authenticated) {
    return {
      label,
      status: "not-authorized",
      fix: AUTH_FIX_COMMANDS[service],
    };
  }

  return { label, status: "ok", fix: undefined };
}

let cachedRequirements: RuntimeRequirement[] | undefined;

function getRuntimeRequirementsStatus(): RuntimeRequirement[] {
  if (cachedRequirements) return cachedRequirements;
  cachedRequirements = SUPPORTED_SERVICES.map((service) =>
    checkServiceRequirement(service),
  );
  return cachedRequirements;
}

/**
 * Formats a list of runtime requirements into a compact or detailed string.
 *
 * All-ok → single line: `Requires: claude, codex (ChatGPT), gemini, gh (Copilot)`
 * Any non-ok → multi-line with inline remediation per requirement.
 */
export function formatRequiresSection(
  requirements: readonly RuntimeRequirement[],
): string {
  if (requirements.every((r) => r.status === "ok")) {
    return `Requires: ${requirements.map((r) => r.label).join(", ")}`;
  }

  const lines = requirements.map((r) => {
    if (r.status === "ok") return `  - ${r.label}`;
    const tag = r.status === "missing" ? "MISSING" : "NOT AUTHORIZED";
    return `  - ${r.label} - ${tag}! ${r.fix}`;
  });

  return `Requires:\n${lines.join("\n")}`;
}

export function formatRequiresHelpText(): string {
  return formatRequiresSection(getRuntimeRequirementsStatus());
}
