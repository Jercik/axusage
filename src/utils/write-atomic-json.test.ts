import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { describe, it, expect, vi } from "vitest";

describe("writeAtomicJson", () => {
  it("writes JSON data with secure permissions", async () => {
    const { writeAtomicJson } = await import("./write-atomic-json.js");
    const base = await mkdtemp(path.join(tmpdir(), "axusage-test-"));
    const target = path.join(base, "state.json");

    await writeAtomicJson(target, { ok: true }, 0o600);

    const content = await readFile(target, "utf8");
    expect(JSON.parse(content)).toEqual({ ok: true });
    const stats = await stat(target);
    expect(stats.mode & 0o777).toBe(0o600);

    await rm(base, { recursive: true, force: true });
  });

  it("cleans up the temporary file when rename fails", async () => {
    vi.resetModules();

    const writeFile = vi.fn(() => Promise.resolve());
    const chmod = vi.fn(() => Promise.resolve());
    const rename = vi.fn(() => Promise.reject(new Error("rename failed")));
    const unlink = vi.fn(() => Promise.resolve());

    vi.doMock("node:fs/promises", () => ({
      writeFile,
      chmod,
      rename,
      unlink,
    }));
    vi.doMock("node:crypto", () => ({
      randomUUID: () => "unit-test",
    }));

    const { writeAtomicJson } = await import("./write-atomic-json.js");

    await expect(
      writeAtomicJson("/tmp/target.json", { ok: true }, 0o600),
    ).rejects.toThrow("rename failed");

    expect(writeFile).toHaveBeenCalledWith(
      "/tmp/target.json.unit-test.tmp",
      JSON.stringify({ ok: true }),
      { encoding: "utf8", mode: 0o600 },
    );
    expect(unlink).toHaveBeenCalledWith("/tmp/target.json.unit-test.tmp");

    vi.unmock("node:fs/promises");
    vi.unmock("node:crypto");
  });

  it("falls back to a backup swap when rename errors match Windows cases", async () => {
    vi.resetModules();

    const writeFile = vi.fn(() => Promise.resolve());
    const chmod = vi.fn(() => Promise.resolve());
    const unlink = vi.fn(() => Promise.resolve());
    const rename = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("rename failed"), { code: "EPERM" }),
      )
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {});

    vi.doMock("node:fs/promises", () => ({
      writeFile,
      chmod,
      rename,
      unlink,
    }));
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce("temp")
      .mockReturnValueOnce("backup");
    vi.doMock("node:crypto", () => ({
      randomUUID,
    }));

    const { writeAtomicJson } = await import("./write-atomic-json.js");

    await writeAtomicJson("/tmp/target.json", { ok: true }, 0o600);

    expect(rename).toHaveBeenNthCalledWith(
      1,
      "/tmp/target.json.temp.tmp",
      "/tmp/target.json",
    );
    expect(rename).toHaveBeenNthCalledWith(
      2,
      "/tmp/target.json",
      "/tmp/target.json.backup.bak",
    );
    expect(rename).toHaveBeenNthCalledWith(
      3,
      "/tmp/target.json.temp.tmp",
      "/tmp/target.json",
    );
    expect(unlink).toHaveBeenCalledWith("/tmp/target.json.backup.bak");

    vi.unmock("node:fs/promises");
    vi.unmock("node:crypto");
  });
});
