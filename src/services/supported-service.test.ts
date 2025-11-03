import { describe, it, expect } from "vitest";
import { validateService, SUPPORTED_SERVICES } from "./supported-service.js";

describe("validateService", () => {
  it("accepts supported services", () => {
    for (const s of SUPPORTED_SERVICES) {
      expect(validateService(s)).toBe(s);
    }
  });

  it("normalizes case", () => {
    expect(validateService("ClAuDe")).toBe("claude");
    expect(validateService("CHATGPT")).toBe("chatgpt");
    expect(validateService("GitHub-Copilot")).toBe("github-copilot");
  });

  it("throws for missing service", () => {
    expect(() => validateService(undefined as unknown as string)).toThrow(
      /Service is required/iu,
    );
  });

  it("throws for unsupported service", () => {
    expect(() => validateService("unknown")).toThrow(/Unsupported service/iu);
  });
});
