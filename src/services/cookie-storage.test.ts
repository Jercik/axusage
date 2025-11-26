import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect } from "vitest";
import {
  formatCookieHeader,
  loadClaudeCookies,
  mergeCookies,
  type Cookie,
} from "./cookie-storage.js";

describe("loadClaudeCookies", () => {
  it("filters to claude.ai domains and subdomains", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "agent-usage-"));
    const storagePath = path.join(directory, "state.json");
    await writeFile(
      storagePath,
      JSON.stringify({
        cookies: [
          { name: "root", value: "1", domain: ".claude.ai" },
          { name: "sub", value: "2", domain: "api.claude.ai" },
          { name: "bad-suffix", value: "3", domain: "claude.ai.evil.com" },
          { name: "missing-domain", value: "4" },
        ],
      }),
      "utf8",
    );

    const result = await loadClaudeCookies(storagePath);
    expect(result).toEqual([
      { name: "root", value: "1", domain: ".claude.ai" },
      { name: "sub", value: "2", domain: "api.claude.ai" },
    ]);
  });

  it("throws on invalid storage state shape", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "agent-usage-"));
    const storagePath = path.join(directory, "state.json");
    await writeFile(storagePath, JSON.stringify({ notCookies: [] }), "utf8");

    await expect(loadClaudeCookies(storagePath)).rejects.toThrow(
      /Invalid storage state format/u,
    );
  });
});

describe("formatCookieHeader", () => {
  it("formats cookies as an HTTP header", () => {
    const cookies: Cookie[] = [
      { name: "one", value: "1" },
      { name: "two", value: "2" },
    ];

    expect(formatCookieHeader(cookies)).toBe("one=1; two=2");
  });
});

describe("mergeCookies", () => {
  it("merges existing cookies with Set-Cookie headers by tuple key", () => {
    const existing: Cookie[] = [
      { name: "session_id", value: "abc", domain: ".claude.ai", path: "/" },
    ];

    const merged = mergeCookies(existing, [
      "session_id=refreshed; Domain=api.claude.ai; Path=/api; HttpOnly",
      "auth_token=token123; Secure; SameSite=None",
      "invalid-header",
    ]);

    expect(merged).toEqual([
      {
        name: "session_id",
        value: "abc",
        domain: ".claude.ai",
        path: "/",
      },
      {
        name: "session_id",
        value: "refreshed",
        domain: "api.claude.ai",
        path: "/api",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "auth_token",
        value: "token123",
        domain: ".claude.ai",
        path: "/",
        secure: true,
        sameSite: "None",
      },
    ]);
  });
});
