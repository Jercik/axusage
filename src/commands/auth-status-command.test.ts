import { checkAuth } from "axauth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axauth", () => ({
  checkAuth: vi.fn(),
}));

vi.mock("../services/supported-service.js", () => ({
  SUPPORTED_SERVICES: ["claude", "codex", "copilot", "gemini"],
  validateService: vi.fn((service: string) => service),
}));

vi.mock("../utils/copilot-gh-token.js", () => ({
  getCopilotTokenFromCustomGhPath: vi.fn(),
}));

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

import { getCopilotTokenFromCustomGhPath } from "../utils/copilot-gh-token.js";
import { authStatusCommand } from "./auth-status-command.js";

const mockCheckAuth = vi.mocked(checkAuth);
const mockGetCopilotTokenFromCustomGhPath = vi.mocked(
  getCopilotTokenFromCustomGhPath,
);

describe("authStatusCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockImplementation(() => {});
    mockGetCopilotTokenFromCustomGhPath.mockReset();
    process.exitCode = undefined;
  });

  it("marks copilot authenticated when AXUSAGE_GH_PATH provides a token", () => {
    mockCheckAuth.mockReturnValue({
      agentId: "copilot",
      authenticated: false,
    });
    mockGetCopilotTokenFromCustomGhPath.mockReturnValue("ghu_custom_token");

    authStatusCommand({ service: "copilot" });

    expect(mockCheckAuth).toHaveBeenCalledWith("copilot");
    expect(mockGetCopilotTokenFromCustomGhPath).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("✓ authenticated"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("AXUSAGE_GH_PATH"),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("sets exit code when service is not authenticated", () => {
    mockCheckAuth.mockReturnValue({
      agentId: "copilot",
      authenticated: false,
    });

    authStatusCommand({ service: "copilot" });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("✗ not authenticated"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("does not use AXUSAGE_GH_PATH fallback for non-copilot services", () => {
    mockCheckAuth.mockReturnValue({
      agentId: "claude",
      authenticated: true,
      method: "OAuth (file)",
    });

    authStatusCommand({ service: "claude" });

    expect(mockCheckAuth).toHaveBeenCalledWith("claude");
    expect(mockGetCopilotTokenFromCustomGhPath).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });
});
