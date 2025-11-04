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

    const text = await formatPrometheusMetrics(data);
    expect(text).toContain("# HELP agent_usage_utilization_percent");
    expect(text).toContain("# TYPE agent_usage_utilization_percent gauge");
    expect(text).toContain(
      'agent_usage_utilization_percent{service="claude",window="5-hour"} 12.34',
    );
    expect(text).toContain(
      'agent_usage_utilization_percent{service="claude",window="monthly"} 56.78',
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
        service: "chatgpt",
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
    const text = await formatPrometheusMetrics(data);
    expect(text).toContain(
      'agent_usage_utilization_percent{service="claude",window="5-hour"} 12.34',
    );
    expect(text).toContain(
      'agent_usage_utilization_percent{service="chatgpt",window="3-hour"} 56.78',
    );
  });

  it("emits headers only for empty data", async () => {
    const text = await formatPrometheusMetrics([]);
    expect(text).toContain("# HELP agent_usage_utilization_percent");
    expect(text).toContain("# TYPE agent_usage_utilization_percent gauge");
    // No sample lines
    expect(text).not.toMatch(/agent_usage_utilization_percent\{/u);
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
    const text = await formatPrometheusMetrics(data);
    expect(text).toContain(
      'agent_usage_utilization_percent{service="claude",window="window"} 0',
    );
  });
});
