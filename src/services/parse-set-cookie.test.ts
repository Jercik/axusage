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

  it("prefers max-age over expires when both are present", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const result = parseSetCookie(
      "token=xyz; Expires=Sun, 06 Nov 1994 08:49:37 GMT; Max-Age=60",
    );

    expect(result?.expires).toBeCloseTo(Date.now() / 1000 + 60, 5);
  });

  it("returns undefined for malformed headers", () => {
    expect(parseSetCookie("")).toBeUndefined();
    expect(parseSetCookie("novalue")).toBeUndefined();
    expect(parseSetCookie("=missingname")).toBeUndefined();
    expect(parseSetCookie("; Secure")).toBeUndefined();
  });
});
