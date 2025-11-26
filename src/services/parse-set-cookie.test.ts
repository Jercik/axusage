import { describe, it, expect, vi, afterEach } from "vitest";
import { parseSetCookie } from "./parse-set-cookie.js";

describe("parseSetCookie", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses attributes and preserves provided values", () => {
    const result = parseSetCookie(
      "session=abc; Domain=api.claude.ai; Path=/api; HttpOnly; Secure; SameSite=None; Expires=Sun, 06 Nov 1994 08:49:37 GMT",
    );

    expect(result).toMatchObject({
      name: "session",
      value: "abc",
      domain: "api.claude.ai",
      path: "/api",
      httpOnly: true,
      secure: true,
      sameSite: "None",
      expires: new Date("Sun, 06 Nov 1994 08:49:37 GMT").getTime() / 1000,
    });
  });

  it("prefers max-age over expires regardless of order", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const expiresFirst = parseSetCookie(
      "token=xyz; Expires=Sun, 06 Nov 1994 08:49:37 GMT; Max-Age=60",
    );

    const maxAgeFirst = parseSetCookie(
      "token=xyz; Max-Age=120; Expires=Sun, 06 Nov 1994 08:49:37 GMT",
    );

    expect(expiresFirst?.expires).toBeCloseTo(Date.now() / 1000 + 60, 5);
    expect(maxAgeFirst?.expires).toBeCloseTo(Date.now() / 1000 + 120, 5);
  });

  it("returns undefined for malformed headers", () => {
    expect(parseSetCookie("")).toBeUndefined();
    expect(parseSetCookie("novalue")).toBeUndefined();
    expect(parseSetCookie("=missingname")).toBeUndefined();
    expect(parseSetCookie("; Secure")).toBeUndefined();
  });

  it("handles empty values and preserves whitespace in values", () => {
    const emptyValue = parseSetCookie("empty=; Path=/");
    const spacedValue = parseSetCookie("token= spaced value ; Path=/; Secure");

    expect(emptyValue).toMatchObject({ name: "empty", value: "" });
    expect(spacedValue).toMatchObject({ name: "token", value: "spaced value" });
  });

  it("supports uppercase attributes and canonicalizes SameSite", () => {
    const result = parseSetCookie(
      "ID=123; DOMAIN=CLAUDE.AI; PATH=/API; HTTPONLY; SECURE; SAMESITE=NONE",
    );

    expect(result).toMatchObject({
      name: "ID",
      value: "123",
      domain: "CLAUDE.AI",
      path: "/API",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
  });

  it("trims domain and path values", () => {
    const result = parseSetCookie(
      "SID=1; Domain= .claude.ai ; Path= /api ; Secure",
    );

    expect(result).toMatchObject({
      domain: ".claude.ai",
      path: "/api",
      secure: true,
      sameSite: "Lax",
    });
  });

  it("defaults SameSite to Lax when invalid", () => {
    const result = parseSetCookie("sid=abc; SameSite=InvalidValue");

    expect(result).toMatchObject({
      name: "sid",
      sameSite: "Lax",
    });
  });
});
