import { execFileSync } from "node:child_process";

const GH_PATH_OVERRIDE_ENV = "AXUSAGE_GH_PATH";
const DEFAULT_TIMEOUT_MS = 5000;

function resolveCliTimeoutMs(): number {
  const rawValue = process.env.AXUSAGE_CLI_TIMEOUT_MS;
  if (!rawValue) return DEFAULT_TIMEOUT_MS;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;

  return Math.round(parsed);
}

function resolveGhOverridePath(): string | undefined {
  const value = process.env[GH_PATH_OVERRIDE_ENV]?.trim();
  if (!value) return undefined;
  return value;
}

export function getCopilotTokenFromCustomGhPath(): string | undefined {
  const path = resolveGhOverridePath();
  if (!path) return undefined;

  try {
    const token = execFileSync(path, ["auth", "token"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: resolveCliTimeoutMs(),
    }).trim();

    // Copilot requires fine-grained tokens; reject classic PATs.
    if (token && !token.startsWith("ghp_")) {
      return token;
    }
  } catch {
    // Ignore command failures and fall back to other auth sources.
  }

  return undefined;
}
