import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mkdtempSync, existsSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import type * as AppPaths from "./app-paths.js";

const environmentPathsMock = vi.fn(() => ({ data: "/tmp/axusage" }));

vi.mock("env-paths", () => ({
  __esModule: true,
  default: environmentPathsMock,
}));

const loadModule = async (): Promise<typeof AppPaths> => {
  vi.resetModules();
  return import("./app-paths.js");
};

describe("getBrowserContextsDirectory", () => {
  beforeEach(() => {
    environmentPathsMock.mockReset();
    environmentPathsMock.mockReturnValue({ data: "/tmp/axusage" });
  });

  it("joins the env-paths data directory with browser-contexts", async () => {
    const { getBrowserContextsDirectory } = await loadModule();
    expect(getBrowserContextsDirectory()).toBe(
      path.join("/tmp/axusage", "browser-contexts"),
    );
  });

  it("returns an absolute directory path", async () => {
    environmentPathsMock.mockReturnValue({
      data: path.resolve("relative-data"),
    });
    const { getBrowserContextsDirectory } = await loadModule();
    expect(path.isAbsolute(getBrowserContextsDirectory())).toBe(true);
  });

  it("initializes env-paths once with suffix disabled", async () => {
    await loadModule();
    expect(environmentPathsMock).toHaveBeenCalledTimes(1);
    expect(environmentPathsMock).toHaveBeenCalledWith("axusage", {
      suffix: "",
    });
  });
});

describe("ensureSecureDirectory", () => {
  it("creates directory with correct permissions when it does not exist", async () => {
    const { ensureSecureDirectory } = await loadModule();
    const temporaryBase = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    const targetDirectory = path.join(temporaryBase, "new-dir");

    await ensureSecureDirectory(targetDirectory);

    expect(existsSync(targetDirectory)).toBe(true);
    const stats = statSync(targetDirectory);
    // Check owner-only permissions (0o700 = rwx------)
    expect(stats.mode & 0o777).toBe(0o700);

    rmSync(temporaryBase, { recursive: true });
  });

  it("handles EEXIST errors when directory already exists", async () => {
    const { ensureSecureDirectory } = await loadModule();
    const temporaryBase = mkdtempSync(path.join(tmpdir(), "axusage-test-"));

    // Should not throw when called on existing directory
    await expect(ensureSecureDirectory(temporaryBase)).resolves.toBeUndefined();

    rmSync(temporaryBase, { recursive: true });
  });

  it("creates nested directories recursively", async () => {
    const { ensureSecureDirectory } = await loadModule();
    const temporaryBase = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    const nestedDirectory = path.join(temporaryBase, "a", "b", "c");

    await ensureSecureDirectory(nestedDirectory);

    expect(existsSync(nestedDirectory)).toBe(true);

    rmSync(temporaryBase, { recursive: true });
  });
});
