import type { SupportedService } from "../services/supported-service.js";
import { getAllServiceDiagnostics } from "../services/service-diagnostics.js";
import type { ServiceDiagnostic } from "../services/service-diagnostics.js";
import { getAuthCliDependency } from "./check-cli-dependency.js";

type RuntimeRequirement =
  | { readonly label: string; readonly status: "ok" }
  | {
      readonly label: string;
      readonly status: "missing" | "not-authorized";
      readonly fix: string;
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

function diagnosticToRequirement(
  diagnostic: ServiceDiagnostic,
): RuntimeRequirement {
  const label = SERVICE_LABELS[diagnostic.service];

  if (!diagnostic.cliAvailable) {
    const dependency = getAuthCliDependency(diagnostic.service);
    return {
      label,
      status: "missing",
      fix:
        `Install: ${dependency.installHint}. ` +
        `Or set ${dependency.envVar}=/path/to/${dependency.command}`,
    };
  }

  if (!diagnostic.authenticated) {
    return {
      label,
      status: "not-authorized",
      fix: AUTH_FIX_COMMANDS[diagnostic.service],
    };
  }

  return { label, status: "ok" };
}

let cachedRequirements: RuntimeRequirement[] | undefined;

function getRuntimeRequirementsStatus(): RuntimeRequirement[] {
  if (cachedRequirements) return cachedRequirements;
  cachedRequirements = getAllServiceDiagnostics().map((d) =>
    diagnosticToRequirement(d),
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
