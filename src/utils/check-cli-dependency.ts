import { execFileSync } from "node:child_process";
import { chalk } from "./color.js";

type CliDependency = {
  readonly command: string;
  readonly envVar: string;
  readonly installHint: string;
};

const CLI_DEPENDENCIES = {
  claude: {
    command: "claude",
    envVar: "AXUSAGE_CLAUDE_PATH",
    installHint: "npm install -g @anthropic-ai/claude-code",
  },
  codex: {
    command: "codex",
    envVar: "AXUSAGE_CODEX_PATH",
    installHint: "npm install -g @openai/codex",
  },
  gemini: {
    command: "gemini",
    envVar: "AXUSAGE_GEMINI_PATH",
    installHint: "npm install -g @google/gemini-cli",
  },
} as const satisfies Record<string, CliDependency>;

type AuthCliService = "claude" | "chatgpt" | "gemini";

export function getAuthCliDependency(service: AuthCliService): CliDependency {
  if (service === "chatgpt") return CLI_DEPENDENCIES.codex;
  return CLI_DEPENDENCIES[service];
}

function resolveCliDependencyPath(dep: CliDependency): string {
  return process.env[dep.envVar] ?? dep.command;
}

export function checkCliDependency(dep: CliDependency): {
  ok: boolean;
  path: string;
} {
  const path = resolveCliDependencyPath(dep);
  try {
    execFileSync(path, ["--version"], { stdio: "ignore" });
    return { ok: true, path };
  } catch {
    return { ok: false, path };
  }
}

export function ensureAuthCliDependency(
  service: AuthCliService,
):
  | { ok: true; path: string }
  | { ok: false; dependency: CliDependency; path: string } {
  const dependency = getAuthCliDependency(service);
  const result = checkCliDependency(dependency);
  if (result.ok) return { ok: true, path: result.path };
  return { ok: false, dependency, path: result.path };
}

export function reportMissingCliDependency(
  dependency: CliDependency,
  path: string,
): void {
  console.error(
    chalk.red(`Error: Required dependency '${dependency.command}' not found.`),
  );
  console.error(chalk.gray(`Looked for: ${path}`));
  console.error(chalk.gray("\nTo fix, either:"));
  console.error(chalk.gray(`  1. Install it: ${dependency.installHint}`));
  console.error(
    chalk.gray(`  2. Set ${dependency.envVar}=/path/to/${dependency.command}`),
  );
  console.error(
    chalk.gray("Try 'axusage --help' for requirements and overrides."),
  );
}

export type { AuthCliService };
