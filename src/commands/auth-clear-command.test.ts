import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("trash", () => ({
  default: vi.fn(async () => {}),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
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

import trash from "trash";
import { existsSync } from "node:fs";
import { authClearCommand } from "./auth-clear-command.js";

const mockTrash = vi.mocked(trash);
const mockExistsSync = vi.mocked(existsSync);

describe("authClearCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves existing auth files to trash", async () => {
    mockExistsSync.mockReturnValue(true);

    await authClearCommand({ service: "claude" });

    expect(mockTrash).toHaveBeenCalledWith(
      ["/tmp/storage.json", "/tmp/meta.json"],
      { glob: false },
    );
  });

  it("does not call trash when no auth files exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await authClearCommand({ service: "claude" });

    expect(mockTrash).not.toHaveBeenCalled();
  });
});
