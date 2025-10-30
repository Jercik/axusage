import { describe, it, expect } from "vitest";
import { toJsonObject } from "./format-service-usage.js";
import type { ServiceUsageData } from "../types/domain.js";

describe("format-service-usage toJsonObject", () => {
  const base: ServiceUsageData = {
    service: "X",
    planType: "plan",
    windows: [
      {
        name: "Primary",
        utilization: 10,
        resetsAt: new Date("2025-01-01T00:00:00Z"),
        periodDurationMs: 1000,
      },
      {
        name: "Secondary",
        utilization: 20,
        resetsAt: new Date("2025-01-02T00:00:00Z"),
        periodDurationMs: 2000,
      },
    ],
    metadata: { allowed: true, limitReached: false },
  };

  it("serializes whole object with ISO dates when no windowName provided", () => {
    const obj = toJsonObject(base) as Record<string, unknown>;
    expect(obj["service"]).toBe("X");
    expect(obj["planType"]).toBe("plan");
    const windows = obj["windows"] as Array<Record<string, unknown>>;
    expect(Array.isArray(windows)).toBe(true);
    expect(windows[0]?.["resetsAt"]).toBe("2025-01-01T00:00:00.000Z");
  });

  it("returns single window when windowName matches (case-insensitive includes)", () => {
    const obj = toJsonObject(base, "prima") as Record<string, unknown>;
    expect(obj["name"]).toBe("Primary");
    expect(obj["resetsAt"]).toBe("2025-01-01T00:00:00.000Z");
  });

  it("returns error object when windowName not found", () => {
    const obj = toJsonObject(base, "missing") as Record<string, unknown>;
    expect(Object.hasOwn(obj, "error")).toBe(true);
  });
});
