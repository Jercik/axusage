import type { ServiceUsageData } from "../types/domain.js";
import { Gauge, Registry } from "prom-client";
import { calculateUsageRate } from "./calculate-usage-rate.js";

/**
 * Formats service usage data as Prometheus text exposition using prom-client.
 * Emits gauges `axusage_utilization_percent` and `axusage_usage_rate` per window.
 */
export async function formatPrometheusMetrics(
  data: readonly ServiceUsageData[],
  now: number,
): Promise<string> {
  const registry = new Registry();

  const utilizationGauge = new Gauge({
    name: "axusage_utilization_percent",
    help: "Current utilization percentage by service/window",
    labelNames: ["service", "window"],
    registers: [registry],
  });

  const rateGauge = new Gauge({
    name: "axusage_usage_rate",
    help: "Usage rate (utilization / elapsed fraction of period); >1 means over budget",
    labelNames: ["service", "window"],
    registers: [registry],
  });

  for (const entry of data) {
    for (const w of entry.windows) {
      const labels = { service: entry.service, window: w.name };
      utilizationGauge.set(labels, w.utilization);

      const rate = calculateUsageRate(
        w.utilization,
        w.resetsAt,
        w.periodDurationMs,
        now,
      );
      if (rate !== undefined) {
        rateGauge.set(labels, rate);
      }
    }
  }

  return registry.metrics();
}
