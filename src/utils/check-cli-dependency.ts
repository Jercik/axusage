import { execFileSync } from "node:child_process";

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

export type { CliDependency, AuthCliService };
