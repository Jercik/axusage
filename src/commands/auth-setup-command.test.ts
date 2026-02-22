import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/supported-service.js", () => ({
  validateService: vi.fn((service: string) => service),
}));

vi.mock("../utils/check-cli-dependency.js", () => ({
  resolveAuthCliDependencyOrReport: vi.fn(() => "/mock/cli"),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

import { authSetupCommand } from "./auth-setup-command.js";

describe("authSetupCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it("directs copilot users to gh auth login", () => {
    authSetupCommand({ service: "copilot" });

    expect(process.exitCode).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("GitHub CLI"),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("auth login"),
    );
  });

  it("directs claude users to claude CLI", () => {
    authSetupCommand({ service: "claude" });

    expect(process.exitCode).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Claude Code"),
    );
  });
});
