import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import {
  checkCliDependency,
  ensureAuthCliDependency,
  getAuthCliDependency,
} from "./check-cli-dependency.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

const ENV_KEYS = [
  "AXUSAGE_CLAUDE_PATH",
  "AXUSAGE_CODEX_PATH",
  "AXUSAGE_GEMINI_PATH",
] as const;

const originalEnvironment = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

describe("check-cli-dependency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnvironment[key];
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  });

  it("maps chatgpt to the codex dependency", () => {
    const dependency = getAuthCliDependency("chatgpt");
    expect(dependency.command).toBe("codex");
    expect(dependency.envVar).toBe("AXUSAGE_CODEX_PATH");
  });

  it("uses env var overrides for dependency path", () => {
    process.env.AXUSAGE_CLAUDE_PATH = "/custom/claude";
    mockExecFileSync.mockImplementation(() => "1.0.0");

    const dependency = getAuthCliDependency("claude");
    const result = checkCliDependency(dependency);

    expect(result.ok).toBe(true);
    expect(result.path).toBe("/custom/claude");
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "/custom/claude",
      ["--version"],
      { stdio: "ignore" },
    );
  });

  it("returns failure details when dependency is missing", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("missing");
    });

    const result = ensureAuthCliDependency("gemini");

    expect(result).toEqual({
      ok: false,
      dependency: {
        command: "gemini",
        envVar: "AXUSAGE_GEMINI_PATH",
        installHint: "npm install -g @google/gemini-cli",
      },
      path: "gemini",
    });
  });
});
