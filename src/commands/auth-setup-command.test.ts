import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setupAuthMock = vi.fn();
const closeMock = vi.fn();

vi.mock("../services/browser-auth-manager.js", () => ({
  BrowserAuthManager: vi.fn().mockImplementation(() => ({
    setupAuth: setupAuthMock,
    close: closeMock,
  })),
}));

vi.mock("../services/supported-service.js", () => ({
  validateService: vi.fn((service: string) => service),
}));

vi.mock("../utils/check-cli-dependency.js", () => ({
  resolveAuthCliDependencyOrReport: vi.fn(() => "/mock/cli"),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

import { BrowserAuthManager } from "../services/browser-auth-manager.js";
import { authSetupCommand } from "./auth-setup-command.js";

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

function setTtyState(stdin: boolean, stdout: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: stdin,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdout,
    configurable: true,
  });
}

describe("authSetupCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    setTtyState(true, true);
  });

  afterEach(() => {
    setTtyState(originalStdinIsTTY, originalStdoutIsTTY);
  });

  it("fails when --interactive is missing for browser auth", async () => {
    await authSetupCommand({ service: "github-copilot", interactive: false });

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("requires --interactive"),
    );
    expect(BrowserAuthManager).not.toHaveBeenCalled();
  });

  it("fails when --interactive is set but no TTY is available", async () => {
    setTtyState(false, false);

    await authSetupCommand({ service: "github-copilot", interactive: true });

    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("TTY-enabled terminal"),
    );
    expect(BrowserAuthManager).not.toHaveBeenCalled();
  });
});
