import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isKnownService,
  getEnvVarCandidates,
  selectServicesToQuery,
  getAccessToken,
  type UsageCommandOptions,
} from "./fetch-service-usage.js";

describe("fetch-service-usage helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("isKnownService detects known services", () => {
    expect(isKnownService("claude")).toBe(true);
    expect(isKnownService("chatgpt")).toBe(true);
    expect(isKnownService("github-copilot")).toBe(true);
    expect(isKnownService("other")).toBe(false);
  });

  it("getEnvVarCandidates returns known list or fallback", () => {
    expect(getEnvVarCandidates("claude")).toEqual(["CLAUDE_ACCESS_TOKEN"]);
    expect(getEnvVarCandidates("custom")).toEqual(["CUSTOM_ACCESS_TOKEN"]);
  });

  it("selectServicesToQuery handles all, undefined, specific", () => {
    expect(selectServicesToQuery(undefined)).toEqual([
      "claude",
      "chatgpt",
      "github-copilot",
    ]);
    expect(selectServicesToQuery("all")).toEqual([
      "claude",
      "chatgpt",
      "github-copilot",
    ]);
    expect(selectServicesToQuery("claude")).toEqual(["claude"]);
  });

  it("getAccessToken uses option.token first, then env", () => {
    const opts: UsageCommandOptions = { token: "TKN" };
    process.env.CLAUDE_ACCESS_TOKEN = "ENV_TKN";
    expect(getAccessToken("claude", opts)).toBe("TKN");

    const envOnly: UsageCommandOptions = {};
    expect(getAccessToken("claude", envOnly)).toBe("ENV_TKN");
  });
});
