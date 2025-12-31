import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createAuthContext,
  loadStoredUserAgent,
} from "./create-auth-context.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "./auth-storage-path.js";

describe("loadStoredUserAgent", () => {
  it("returns userAgent when meta file exists with valid data", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const metaPath = getAuthMetaPathFor(directory, "claude");
      writeFileSync(metaPath, JSON.stringify({ userAgent: "UA-Test" }), "utf8");

      const result = await loadStoredUserAgent(directory, "claude");
      expect(result).toBe("UA-Test");
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("returns undefined when meta file does not exist", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const result = await loadStoredUserAgent(directory, "claude");
      expect(result).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("returns undefined when meta file contains invalid JSON", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const metaPath = getAuthMetaPathFor(directory, "claude");
      writeFileSync(metaPath, "not valid json {{{", "utf8");

      const result = await loadStoredUserAgent(directory, "claude");
      expect(result).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("returns undefined when userAgent field is not a string", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const metaPath = getAuthMetaPathFor(directory, "claude");
      writeFileSync(metaPath, JSON.stringify({ userAgent: 12_345 }), "utf8");

      const result = await loadStoredUserAgent(directory, "claude");
      expect(result).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("returns undefined when userAgent field is missing", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const metaPath = getAuthMetaPathFor(directory, "claude");
      writeFileSync(metaPath, JSON.stringify({ other: "data" }), "utf8");

      const result = await loadStoredUserAgent(directory, "claude");
      expect(result).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});

describe("createAuthContext", () => {
  it("creates a context with storage state and user agent from meta", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "axusage-test-"));
    try {
      const storagePath = getStorageStatePathFor(directory, "claude");
      const metaPath = getAuthMetaPathFor(directory, "claude");
      // Minimal valid JSON files
      writeFileSync(storagePath, "{}", "utf8");
      writeFileSync(metaPath, JSON.stringify({ userAgent: "UA-Test" }), "utf8");

      const calls: Array<{ storageState: string; userAgent?: string }> = [];
      const fakeBrowser: unknown = {
        newContext: (options: { storageState: string; userAgent?: string }) => {
          calls.push(options);
          return Promise.resolve(
            {} as unknown as import("playwright").BrowserContext,
          );
        },
      } as const;

      const contextResult = await createAuthContext(
        fakeBrowser as import("playwright").Browser,
        directory,
        "claude",
      );
      expect(contextResult).toBeTruthy();
      expect(calls).toHaveLength(1);
      const options = calls[0] as { storageState: string; userAgent?: string };
      expect(options.storageState).toBe(storagePath);
      expect(options.userAgent).toBe("UA-Test");
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
