import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BrowserContext } from "playwright";

vi.mock("./fetch-json-with-context.js", () => ({
  fetchJsonWithContext: vi.fn((_context: unknown, url: string) =>
    Promise.resolve(`generic:${url}`),
  ),
}));

import { requestService } from "./request-service.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

const getContext = () => Promise.resolve({} as unknown as BrowserContext);

describe("requestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes claude to generic fetch", async () => {
    const result = await requestService(
      "claude",
      "https://example/ignored",
      getContext,
    );
    expect(result).toBe("generic:https://example/ignored");
    expect(fetchJsonWithContext).toHaveBeenCalledTimes(1);
    expect(fetchJsonWithContext).toHaveBeenCalledWith(
      expect.anything(),
      "https://example/ignored",
    );
  });

  it("routes chatgpt to generic fetch", async () => {
    const result = await requestService(
      "chatgpt",
      "https://example/api",
      getContext,
    );
    expect(result).toBe("generic:https://example/api");
    expect(fetchJsonWithContext).toHaveBeenCalledTimes(1);
    expect(fetchJsonWithContext).toHaveBeenCalledWith(
      expect.anything(),
      "https://example/api",
    );
  });

  it("routes others to generic fetch", async () => {
    const result = await requestService(
      "github-copilot",
      "https://example/entitlement",
      getContext,
    );
    expect(result).toBe("generic:https://example/entitlement");
    expect(fetchJsonWithContext).toHaveBeenCalledTimes(1);
    expect(fetchJsonWithContext).toHaveBeenCalledWith(
      expect.anything(),
      "https://example/entitlement",
    );
  });
});
