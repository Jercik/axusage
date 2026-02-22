import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/service-diagnostics.js", () => ({
  getServiceDiagnostic: vi.fn(),
}));

vi.mock("../services/supported-service.js", () => ({
  SUPPORTED_SERVICES: ["claude", "codex", "copilot", "gemini"],
  validateService: vi.fn((service: string) => service),
}));

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

import { getServiceDiagnostic } from "../services/service-diagnostics.js";
import { authStatusCommand } from "./auth-status-command.js";

const mockGetServiceDiagnostic = vi.mocked(getServiceDiagnostic);

describe("authStatusCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockImplementation(() => {});
    process.exitCode = undefined;
  });

  it("marks copilot authenticated when AXUSAGE_GH_PATH provides a token", () => {
    mockGetServiceDiagnostic.mockReturnValue({
      service: "copilot",
      cliAvailable: true,
      cliPath: "/usr/local/bin/gh",
      authenticated: true,
      authMethod: "GitHub CLI (AXUSAGE_GH_PATH)",
    });

    authStatusCommand({ service: "copilot" });

    expect(mockGetServiceDiagnostic).toHaveBeenCalledWith("copilot");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("✓ authenticated"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("AXUSAGE_GH_PATH"),
    );
    expect(process.exitCode).toBeUndefined();
  });

  it("sets exit code when service is not authenticated", () => {
    mockGetServiceDiagnostic.mockReturnValue({
      service: "copilot",
      cliAvailable: true,
      cliPath: "/usr/local/bin/gh",
      authenticated: false,
      authMethod: undefined,
    });

    authStatusCommand({ service: "copilot" });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("✗ not authenticated"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("shows auth method for authenticated services", () => {
    mockGetServiceDiagnostic.mockReturnValue({
      service: "claude",
      cliAvailable: true,
      cliPath: "/usr/local/bin/claude",
      authenticated: true,
      authMethod: "OAuth (file)",
    });

    authStatusCommand({ service: "claude" });

    expect(mockGetServiceDiagnostic).toHaveBeenCalledWith("claude");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("✓ authenticated"),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("OAuth (file)"),
    );
    expect(process.exitCode).toBeUndefined();
  });
});
