import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./fetch-claude-json-from-page.js", () => ({
  fetchClaudeJsonFromPage: vi.fn(() => Promise.resolve("claude-json")),
}));

vi.mock("./fetch-chatgpt-json.js", () => ({
  fetchChatGPTJson: vi.fn((_context: unknown, url: string) =>
    Promise.resolve(`chatgpt:${url}`),
  ),
}));

vi.mock("./fetch-json-with-context.js", () => ({
  fetchJsonWithContext: vi.fn((_context: unknown, url: string) =>
    Promise.resolve(`generic:${url}`),
  ),
}));

import { requestService } from "./request-service.js";
import { fetchClaudeJsonFromPage } from "./fetch-claude-json-from-page.js";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

const getContext = () =>
  Promise.resolve({} as unknown as import("playwright").BrowserContext);

describe("requestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes claude to page-capture helper", async () => {
    const result = await requestService(
      "claude",
      "https://example/ignored",
      getContext,
    );
    expect(result).toBe("claude-json");
    expect(fetchClaudeJsonFromPage).toHaveBeenCalledTimes(1);
    expect(fetchChatGPTJson).not.toHaveBeenCalled();
    expect(fetchJsonWithContext).not.toHaveBeenCalled();
  });

  it("routes chatgpt to chatgpt helper with url", async () => {
    const result = await requestService(
      "chatgpt",
      "https://example/api",
      getContext,
    );
    expect(result).toBe("chatgpt:https://example/api");
    expect(fetchChatGPTJson).toHaveBeenCalledTimes(1);
    expect(fetchChatGPTJson).toHaveBeenCalledWith(
      expect.anything(),
      "https://example/api",
    );
    expect(fetchClaudeJsonFromPage).not.toHaveBeenCalled();
    expect(fetchJsonWithContext).not.toHaveBeenCalled();
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
    expect(fetchClaudeJsonFromPage).not.toHaveBeenCalled();
    expect(fetchChatGPTJson).not.toHaveBeenCalled();
  });
});
