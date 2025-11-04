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
});
