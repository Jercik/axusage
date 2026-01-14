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

const AUTH_CLI_SERVICES = ["claude", "chatgpt", "gemini"] as const;
type AuthCliService = (typeof AUTH_CLI_SERVICES)[number];

function resolveCliDependencyTimeout(): number {
  const raw = process.env.AXUSAGE_CLI_TIMEOUT_MS;
  if (!raw) return 5000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5000;
  return Math.round(parsed);
}

export function getAuthCliDependency(service: AuthCliService): CliDependency {
  if (service === "chatgpt") return CLI_DEPENDENCIES.codex;
  return CLI_DEPENDENCIES[service];
}

function resolveCliDependencyPath(dep: CliDependency): string {
  const environmentValue = process.env[dep.envVar];
  // Treat empty env vars as unset to fall back to the default command.
  if (environmentValue) return environmentValue;
  return dep.command;
}

export function checkCliDependency(dep: CliDependency): {
  ok: boolean;
  path: string;
} {
  const path = resolveCliDependencyPath(dep);
  try {
    const timeout = resolveCliDependencyTimeout();
    execFileSync(path, ["--version"], {
      stdio: "ignore",
      timeout,
    });
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

export function resolveAuthCliDependencyOrReport(
  service: AuthCliService,
  options: { readonly setExitCode?: boolean } = {},
): string | undefined {
  const result = ensureAuthCliDependency(service);
  if (!result.ok) {
    reportMissingCliDependency(result.dependency, result.path);
    if (options.setExitCode) process.exitCode = 1;
    return undefined;
  }
  return result.path;
}

function reportMissingCliDependency(
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

export { AUTH_CLI_SERVICES };
export type { AuthCliService };
