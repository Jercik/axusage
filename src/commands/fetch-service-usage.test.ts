import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isKnownService,
  getEnvironmentVariableCandidates,
  selectServicesToQuery,
  getAccessToken,
  type UsageCommandOptions,
} from "./fetch-service-usage.js";

describe("fetch-service-usage helpers", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });
  afterEach(() => {
    process.env = originalEnvironment;
  });

  it("isKnownService detects known services", () => {
    expect(isKnownService("claude")).toBe(true);
    expect(isKnownService("chatgpt")).toBe(true);
    expect(isKnownService("github-copilot")).toBe(true);
    expect(isKnownService("other")).toBe(false);
  });

  it("getEnvVarCandidates returns known list or fallback", () => {
    expect(getEnvironmentVariableCandidates("claude")).toEqual([
      "CLAUDE_ACCESS_TOKEN",
    ]);
    expect(getEnvironmentVariableCandidates("custom")).toEqual([
      "CUSTOM_ACCESS_TOKEN",
    ]);
  });

  it("selectServicesToQuery handles all, undefined, specific", () => {
    expect(selectServicesToQuery()).toEqual([
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
    const options: UsageCommandOptions = { token: "TKN" };
    process.env.CLAUDE_ACCESS_TOKEN = "ENV_TKN";
    expect(getAccessToken("claude", options)).toBe("TKN");

    const environmentOnly: UsageCommandOptions = {};
    expect(getAccessToken("claude", environmentOnly)).toBe("ENV_TKN");
  });
});
