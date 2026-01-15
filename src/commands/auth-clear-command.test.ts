import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

vi.mock("trash", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock("../services/supported-service.js", () => ({
  validateService: vi.fn((service: string) => service),
}));

vi.mock("../services/auth-storage-path.js", () => ({
  getStorageStatePathFor: vi.fn(() => "/tmp/storage.json"),
  getAuthMetaPathFor: vi.fn(() => "/tmp/meta.json"),
}));

vi.mock("../services/app-paths.js", () => ({
  getBrowserContextsDirectory: vi.fn(() => "/tmp/contexts"),
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { confirm } from "@inquirer/prompts";
import trash from "trash";
import { existsSync, readdirSync } from "node:fs";
import { authClearCommand } from "./auth-clear-command.js";

const mockTrash = vi.mocked(trash);
const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockConfirm = vi.mocked(confirm);

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

describe("authClearCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    setTtyState(true, true);
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    setTtyState(originalStdinIsTTY, originalStdoutIsTTY);
  });

  it("moves existing auth files to trash", async () => {
    mockExistsSync.mockReturnValue(true);

    await authClearCommand({ service: "claude", force: true });

    expect(mockTrash).toHaveBeenCalledWith(
      ["/tmp/storage.json", "/tmp/meta.json"],
      { glob: false },
    );
  });

  it("does not call trash when no auth files exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await authClearCommand({ service: "claude", force: true });

    expect(mockTrash).not.toHaveBeenCalled();
  });

  it("clears backup artifacts even when primary files are missing", async () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([
      "storage.json.abc.bak",
    ] as unknown as ReturnType<typeof readdirSync>);

    await authClearCommand({ service: "claude", force: true });

    expect(mockTrash).toHaveBeenCalledWith(["/tmp/storage.json.abc.bak"], {
      glob: false,
    });
  });

  it("fails when confirmation is required but --interactive is missing", async () => {
    mockExistsSync.mockReturnValue(true);

    await authClearCommand({ service: "claude" });

    expect(process.exitCode).toBe(1);
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it("fails when --interactive is set but no TTY is available", async () => {
    mockExistsSync.mockReturnValue(true);
    setTtyState(false, false);

    await authClearCommand({ service: "claude", interactive: true });

    expect(process.exitCode).toBe(1);
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it("aborts when confirmation is declined", async () => {
    mockExistsSync.mockReturnValue(true);
    mockConfirm.mockResolvedValue(false);

    await authClearCommand({ service: "claude", interactive: true });

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it("sets exit code when confirmation is canceled", async () => {
    mockExistsSync.mockReturnValue(true);
    const error = new Error("canceled");
    error.name = "CancelPromptError";
    mockConfirm.mockRejectedValue(error);

    await authClearCommand({ service: "claude", interactive: true });

    expect(process.exitCode).toBe(1);
    expect(mockTrash).not.toHaveBeenCalled();
  });

  it("clears auth when confirmation is accepted", async () => {
    mockExistsSync.mockReturnValue(true);
    mockConfirm.mockResolvedValue(true);

    await authClearCommand({ service: "claude", interactive: true });

    expect(mockTrash).toHaveBeenCalled();
  });
});
