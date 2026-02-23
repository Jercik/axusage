import { describe, it, expect } from "vitest";
import type { ServiceUsageData } from "../types/domain.js";
import { formatPrometheusMetrics } from "./format-prometheus-metrics.js";

describe("formatPrometheusMetrics", () => {
  it("emits gauge per window with labels", async () => {
    const data: ServiceUsageData[] = [
      {
        service: "claude",
        windows: [
          {
            name: "5-hour",
            utilization: 12.34,
            resetsAt: new Date("2025-01-01T00:00:00Z"),
            periodDurationMs: 5 * 60 * 60 * 1000,
          },
          {
            name: "monthly",
            utilization: 56.78,
            resetsAt: new Date("2025-01-31T00:00:00Z"),
            periodDurationMs: 30 * 24 * 60 * 60 * 1000,
          },
        ],
      },
    ];

    const text = await formatPrometheusMetrics(data, 0);
    expect(text).toContain("# HELP axusage_utilization_percent");
    expect(text).toContain("# TYPE axusage_utilization_percent gauge");
    expect(text).toContain(
      'axusage_utilization_percent{service="claude",window="5-hour"} 12.34',
    );
    expect(text).toContain(
      'axusage_utilization_percent{service="claude",window="monthly"} 56.78',
    );
  });

  it("handles multiple services", async () => {
    const data: ServiceUsageData[] = [
      {
        service: "claude",
        windows: [
          {
            name: "5-hour",
            utilization: 12.34,
            resetsAt: new Date("2025-01-01T00:00:00Z"),
            periodDurationMs: 1000,
          },
        ],
      },
      {
        service: "codex",
        windows: [
          {
            name: "3-hour",
            utilization: 56.78,
            resetsAt: new Date("2025-01-01T00:00:00Z"),
            periodDurationMs: 1000,
          },
        ],
      },
    ];
    const text = await formatPrometheusMetrics(data, 0);
    expect(text).toContain(
      'axusage_utilization_percent{service="claude",window="5-hour"} 12.34',
    );
    expect(text).toContain(
      'axusage_utilization_percent{service="codex",window="3-hour"} 56.78',
    );
  });

  it("emits headers only for empty data", async () => {
    const text = await formatPrometheusMetrics([], 0);
    expect(text).toContain("# HELP axusage_utilization_percent");
    expect(text).toContain("# TYPE axusage_utilization_percent gauge");
    expect(text).toContain("# HELP axusage_usage_rate");
    expect(text).toContain("# TYPE axusage_usage_rate gauge");
    // No sample lines
    expect(text).not.toMatch(/axusage_utilization_percent\{/u);
    expect(text).not.toMatch(/axusage_usage_rate\{/u);
  });

  it("handles zero utilization values", async () => {
    const data: ServiceUsageData[] = [
      {
        service: "claude",
        windows: [
          {
            name: "window",
            utilization: 0,
            resetsAt: new Date("2025-01-01T00:00:00Z"),
            periodDurationMs: 1000,
          },
        ],
      },
    ];
    const text = await formatPrometheusMetrics(data, 0);
    expect(text).toContain(
      'axusage_utilization_percent{service="claude",window="window"} 0',
    );
  });

  it("emits rate gauge when rate is calculable", async () => {
    // Period: 10 hours, resets 5 hours from now → 50% elapsed
    // Utilization: 50% → rate = 50 / 50 = 1.0
    const periodDurationMs = 10 * 60 * 60 * 1000;
    const now = Date.parse("2025-06-15T12:00:00Z");
    const resetsAt = new Date(now + 5 * 60 * 60 * 1000); // 5h from now

    const data: ServiceUsageData[] = [
      {
        service: "claude",
        windows: [
          {
            name: "5-hour",
            utilization: 50,
            resetsAt,
            periodDurationMs,
          },
        ],
      },
    ];

    const text = await formatPrometheusMetrics(data, now);
    expect(text).toContain(
      'axusage_usage_rate{service="claude",window="5-hour"} 1',
    );
  });

  it("omits rate sample when rate is undefined", async () => {
    const data: ServiceUsageData[] = [
      {
        service: "claude",
        windows: [
          {
            name: "daily",
            utilization: 10,
            resetsAt: undefined,
            periodDurationMs: 24 * 60 * 60 * 1000,
          },
        ],
      },
    ];

    const text = await formatPrometheusMetrics(data, 0);
    // Headers should still be present
    expect(text).toContain("# HELP axusage_usage_rate");
    expect(text).toContain("# TYPE axusage_usage_rate gauge");
    // But no sample line
    expect(text).not.toMatch(/axusage_usage_rate\{/u);
  });
});
