import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BrowserContext } from "playwright";

vi.mock("./fetch-json-with-context.js", () => ({
  fetchJsonWithContext: vi.fn(() => Promise.resolve("ok")),
}));

import { verifySessionByFetching } from "./verify-session.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

describe("verifySessionByFetching", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true on successful fetch", async () => {
    (
      fetchJsonWithContext as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce("ok");
    const ok = await verifySessionByFetching(
      {} as unknown as BrowserContext,
      "https://example",
      1,
      1,
    );
    expect(ok).toBe(true);
    expect(fetchJsonWithContext).toHaveBeenCalledTimes(1);
  });

  it("retries and returns false when all attempts fail", async () => {
    (
      fetchJsonWithContext as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error("fail"));
    const ok = await verifySessionByFetching(
      {} as unknown as BrowserContext,
      "https://example",
      2,
      1,
    );
    expect(ok).toBe(false);
    expect(fetchJsonWithContext).toHaveBeenCalledTimes(2);
  });
});
