import { describe, it, expect } from "vitest";
import { getServiceAuthConfig } from "./service-auth-configs.js";

describe("getServiceAuthConfig", () => {
  it("returns a config for each service with required fields", () => {
    const claude = getServiceAuthConfig("claude");
    expect(claude.url).toMatch(/^https?:\/\//u);
    expect(claude.instructions.length).toBeGreaterThan(0);
    expect(claude.waitForSelectors?.length).toBeGreaterThan(0);

    const chatgpt = getServiceAuthConfig("chatgpt");
    expect(chatgpt.url).toMatch(/^https?:\/\//u);
    expect(chatgpt.instructions.length).toBeGreaterThan(0);
    expect(chatgpt.waitForSelectors?.length).toBeGreaterThan(0);
    expect(chatgpt.verifyUrl).toMatch(/^https?:\/\//u);

    const copilot = getServiceAuthConfig("github-copilot");
    expect(copilot.url).toMatch(/^https?:\/\//u);
    expect(copilot.instructions.length).toBeGreaterThan(0);
    // Either waitForSelector or waitForSelectors must be present
    expect(
      Boolean(copilot.waitForSelector) ||
        (copilot.waitForSelectors?.length ?? 0) > 0,
    ).toBe(true);
    expect(copilot.verifyUrl).toMatch(/^https?:\/\//u);
  });
});
