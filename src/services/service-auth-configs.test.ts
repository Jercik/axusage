import { describe, it, expect } from "vitest";
import { getServiceAuthConfig } from "./service-auth-configs.js";

describe("getServiceAuthConfig", () => {
  it("returns CLI-based auth config for claude", () => {
    const claude = getServiceAuthConfig("claude");
    expect(claude.url).toBe("");
    expect(claude.instructions).toContain("claude");
  });

  it("returns CLI-based auth config for chatgpt", () => {
    const chatgpt = getServiceAuthConfig("chatgpt");
    expect(chatgpt.url).toBe("");
    expect(chatgpt.instructions).toContain("codex");
  });

  it("returns CLI-based auth config for gemini", () => {
    const gemini = getServiceAuthConfig("gemini");
    expect(gemini.url).toBe("");
    expect(gemini.instructions).toContain("gemini");
  });

  it("returns browser-based auth config for github-copilot", () => {
    const copilot = getServiceAuthConfig("github-copilot");
    expect(copilot.url).toMatch(/^https?:\/\//u);
    expect(copilot.instructions.length).toBeGreaterThan(0);
    expect(
      Boolean(copilot.waitForSelector) ||
        (copilot.waitForSelectors?.length ?? 0) > 0,
    ).toBe(true);
    expect(copilot.verifyUrl).toMatch(/^https?:\/\//u);
  });
});
