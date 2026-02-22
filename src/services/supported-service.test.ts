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
    expect(validateService("CODEX")).toBe("codex");
    expect(validateService("Copilot")).toBe("copilot");
  });

  it("throws for missing service", () => {
    expect(() => validateService(undefined as unknown as string)).toThrowError(
      /Service is required/iu,
    );
  });

  it("throws for unsupported service", () => {
    expect(() => validateService("unknown")).toThrowError(
      /Unsupported service/iu,
    );
  });
});
