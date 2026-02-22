import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCopilotTokenFromCustomGhPath } from "./copilot-gh-token.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

const mockExecFileSync = vi.mocked(execFileSync);

const ENV_KEYS = ["AXUSAGE_GH_PATH", "AXUSAGE_CLI_TIMEOUT_MS"] as const;
const ORIGINAL_ENVIRONMENT = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

describe("copilot-gh-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const originalValue = ORIGINAL_ENVIRONMENT[key];
      if (originalValue === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it("returns undefined when AXUSAGE_GH_PATH is unset", () => {
    Reflect.deleteProperty(process.env, "AXUSAGE_GH_PATH");

    const token = getCopilotTokenFromCustomGhPath();

    expect(token).toBeUndefined();
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it("uses AXUSAGE_GH_PATH to resolve a token", () => {
    process.env.AXUSAGE_GH_PATH = "/custom/bin/gh";
    mockExecFileSync.mockReturnValue("ghu_test_token\n");

    const token = getCopilotTokenFromCustomGhPath();

    expect(token).toBe("ghu_test_token");
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "/custom/bin/gh",
      ["auth", "token"],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      },
    );
  });

  it("uses AXUSAGE_CLI_TIMEOUT_MS when provided", () => {
    process.env.AXUSAGE_GH_PATH = "/custom/bin/gh";
    process.env.AXUSAGE_CLI_TIMEOUT_MS = "12000";
    mockExecFileSync.mockReturnValue("ghu_test_token\n");

    const token = getCopilotTokenFromCustomGhPath();

    expect(token).toBe("ghu_test_token");
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "/custom/bin/gh",
      ["auth", "token"],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 12_000,
      },
    );
  });

  it("rejects classic GitHub tokens", () => {
    process.env.AXUSAGE_GH_PATH = "/custom/bin/gh";
    mockExecFileSync.mockReturnValue("ghp_classic_pat\n");

    const token = getCopilotTokenFromCustomGhPath();

    expect(token).toBeUndefined();
  });

  it("returns undefined when custom gh invocation fails", () => {
    process.env.AXUSAGE_GH_PATH = "/custom/bin/gh";
    mockExecFileSync.mockImplementation(() => {
      throw new Error("command failed");
    });

    const token = getCopilotTokenFromCustomGhPath();

    expect(token).toBeUndefined();
  });
});
