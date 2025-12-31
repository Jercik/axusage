import { describe, it, expect } from "vitest";
import {
  toJsonObject,
  formatServiceUsageAsTsv,
} from "./format-service-usage.js";
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

  it("serializes whole object with ISO dates", () => {
    const object = toJsonObject(base) as Record<string, unknown>;
    expect(object["service"]).toBe("X");
    expect(object["planType"]).toBe("plan");
    const windows = object["windows"] as Array<Record<string, unknown>>;
    expect(Array.isArray(windows)).toBe(true);
    expect(windows[0]?.["resetsAt"]).toBe("2025-01-01T00:00:00.000Z");
  });

  it("omits reset timestamps when unavailable", () => {
    const object = toJsonObject({
      ...base,
      windows: [
        {
          name: "Primary",
          utilization: 10,
          resetsAt: undefined,
          periodDurationMs: 1000,
        },
      ],
    }) as Record<string, unknown>;
    const windows = object["windows"] as Array<Record<string, unknown>>;
    expect(windows[0]?.["resetsAt"]).toBeUndefined();
  });
});

describe("format-service-usage formatServiceUsageAsTsv", () => {
  // Use a fixed "now" to make rate calculation deterministic
  const now = new Date("2025-01-01T00:00:00Z");
  // Window resets in 2.5 hours (half the 5-hour period elapsed)
  const resetsAt = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);
  const periodDurationMs = 5 * 60 * 60 * 1000; // 5 hours

  const base: ServiceUsageData = {
    service: "claude",
    planType: "Max",
    windows: [
      {
        name: "5-Hour Usage",
        utilization: 25,
        resetsAt,
        periodDurationMs,
      },
    ],
  };

  it("outputs header row with UPPERCASE column names", () => {
    const output = formatServiceUsageAsTsv([base]);
    const lines = output.split("\n");
    expect(lines[0]).toBe(
      "SERVICE\tPLAN\tWINDOW\tUTILIZATION\tRATE\tRESETS_AT",
    );
  });

  it("outputs one row per window with tab-delimited fields", () => {
    const output = formatServiceUsageAsTsv([base]);
    const lines = output.split("\n");
    expect(lines).toHaveLength(2); // header + 1 data row
    const fields = lines[1]?.split("\t");
    expect(fields).toHaveLength(6);
    expect(fields?.[0]).toBe("claude");
    expect(fields?.[1]).toBe("Max");
    expect(fields?.[2]).toBe("5-Hour Usage");
    expect(fields?.[3]).toBe("25.00");
  });

  it("outputs ISO timestamps for reset times", () => {
    const output = formatServiceUsageAsTsv([base]);
    const lines = output.split("\n");
    const fields = lines[1]?.split("\t");
    expect(fields?.[5]).toBe(resetsAt.toISOString());
  });

  it("uses dash for missing plan type", () => {
    const noPlan: ServiceUsageData = { ...base, planType: undefined };
    const output = formatServiceUsageAsTsv([noPlan]);
    const lines = output.split("\n");
    const fields = lines[1]?.split("\t");
    expect(fields?.[1]).toBe("-");
  });

  it("uses dash for missing reset time", () => {
    const noReset: ServiceUsageData = {
      ...base,
      windows: [
        {
          name: "5-Hour Usage",
          utilization: 25,
          resetsAt: undefined,
          periodDurationMs,
        },
      ],
    };
    const output = formatServiceUsageAsTsv([noReset]);
    const lines = output.split("\n");
    const fields = lines[1]?.split("\t");
    expect(fields?.[5]).toBe("-");
  });

  it("outputs multiple services with multiple windows", () => {
    const multi: ServiceUsageData[] = [
      {
        service: "claude",
        planType: "Max",
        windows: [
          { name: "5-Hour", utilization: 10, resetsAt, periodDurationMs },
          { name: "7-Day", utilization: 20, resetsAt, periodDurationMs },
        ],
      },
      {
        service: "chatgpt",
        planType: "pro",
        windows: [
          { name: "Primary", utilization: 30, resetsAt, periodDurationMs },
        ],
      },
    ];
    const output = formatServiceUsageAsTsv(multi);
    const lines = output.split("\n");
    expect(lines).toHaveLength(4); // header + 3 data rows
    expect(lines[1]?.startsWith("claude")).toBe(true);
    expect(lines[2]?.startsWith("claude")).toBe(true);
    expect(lines[3]?.startsWith("chatgpt")).toBe(true);
  });

  it("can be parsed by splitting on tabs", () => {
    const output = formatServiceUsageAsTsv([base]);
    const lines = output.split("\n");
    // Simulate `cut -f1` (first column)
    const services = lines.slice(1).map((line) => line.split("\t")[0]);
    expect(services).toEqual(["claude"]);
  });
});
