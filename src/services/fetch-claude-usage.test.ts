import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./cookie-storage.js", () => ({
  loadClaudeCookies: vi.fn(),
  saveCookies: vi.fn(),
  formatCookieHeader: vi.fn(() => "cookie-header"),
  mergeCookies: vi.fn(),
}));

import { fetchClaudeUsage } from "./fetch-claude-usage.js";
import {
  loadClaudeCookies,
  saveCookies,
  formatCookieHeader,
  mergeCookies,
  type Cookie,
} from "./cookie-storage.js";

const mockResponse = (
  data: unknown,
  options?: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    setCookies?: readonly string[];
  },
) =>
  ({
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? "OK",
    json: vi.fn().mockResolvedValue(data),
    headers: {
      getSetCookie: vi.fn().mockReturnValue(options?.setCookies ?? []),
    },
  }) as unknown as Response;

describe("fetchClaudeUsage", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("throws when no cookies are available", async () => {
    vi.mocked(loadClaudeCookies).mockResolvedValue([]);

    await expect(fetchClaudeUsage("/tmp/state.json")).rejects.toThrow(
      /No saved session/u,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws on authentication failures", async () => {
    vi.mocked(loadClaudeCookies).mockResolvedValue([
      { name: "session", value: "abc" },
    ]);
    vi.mocked(formatCookieHeader).mockReturnValue("session=abc");
    fetchSpy.mockResolvedValue(
      mockResponse(undefined, {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    await expect(fetchClaudeUsage("/tmp/state.json")).rejects.toThrow(
      /Authentication failed/u,
    );
    expect(saveCookies).not.toHaveBeenCalled();
  });

  it("fetches org and usage, merges cookies, and saves state", async () => {
    const initialCookies: Cookie[] = [{ name: "session", value: "abc" }];
    const cookiesForUsage: Cookie[] = [{ name: "session", value: "refreshed" }];
    const finalCookies: Cookie[] = [
      { name: "session", value: "final", domain: ".claude.ai" },
    ];

    vi.mocked(loadClaudeCookies).mockResolvedValue(initialCookies);
    vi.mocked(formatCookieHeader)
      .mockReturnValueOnce("session=abc")
      .mockReturnValueOnce("session=refreshed");
    vi.mocked(mergeCookies)
      .mockReturnValueOnce(cookiesForUsage)
      .mockReturnValueOnce(finalCookies);

    fetchSpy
      .mockResolvedValueOnce(
        mockResponse([{ uuid: "org-123" }], {
          setCookies: ["org=1; Path=/"],
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({ usage: 42 }, { setCookies: ["usage=1; Path=/"] }),
      );

    const result = await fetchClaudeUsage("/tmp/state.json");

    expect(result).toBe(JSON.stringify({ usage: 42 }));
    const firstCall = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(firstCall[0]).toBe("https://claude.ai/api/organizations");
    expect(firstCall[1].headers).toEqual(
      expect.objectContaining({ Cookie: "session=abc" }),
    );

    const secondCall = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(secondCall[0]).toBe(
      "https://claude.ai/api/organizations/org-123/usage",
    );
    expect(secondCall[1].headers).toEqual(
      expect.objectContaining({ Cookie: "session=refreshed" }),
    );
    expect(mergeCookies).toHaveBeenNthCalledWith(1, initialCookies, [
      "org=1; Path=/",
    ]);
    expect(mergeCookies).toHaveBeenNthCalledWith(2, initialCookies, [
      "org=1; Path=/",
      "usage=1; Path=/",
    ]);
    expect(saveCookies).toHaveBeenCalledWith(finalCookies, "/tmp/state.json");
  });
});
