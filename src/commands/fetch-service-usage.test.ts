import { describe, it, expect } from "vitest";
import { selectServicesToQuery } from "./fetch-service-usage.js";

describe("fetch-service-usage helpers", () => {
  it("selectServicesToQuery handles all, undefined, specific", () => {
    expect(selectServicesToQuery()).toEqual([
      "claude",
      "chatgpt",
      "github-copilot",
      "gemini",
    ]);
    expect(selectServicesToQuery("all")).toEqual([
      "claude",
      "chatgpt",
      "github-copilot",
      "gemini",
    ]);
    expect(selectServicesToQuery("claude")).toEqual(["claude"]);
    expect(selectServicesToQuery("gemini")).toEqual(["gemini"]);
  });
});
