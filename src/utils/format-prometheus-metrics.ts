import type { ServiceUsageData } from "../types/domain.js";
import { Gauge, Registry } from "prom-client";

/**
 * Formats service usage data as Prometheus text exposition using prom-client.
 * Emits a gauge `agent_usage_utilization_percent{service,window}` per window.
 */
export async function formatPrometheusMetrics(
  data: readonly ServiceUsageData[],
): Promise<string> {
  const registry = new Registry();

  const gauge = new Gauge({
    name: "agent_usage_utilization_percent",
    help: "Current utilization percentage by service/window",
    labelNames: ["service", "window"],
    registers: [registry],
  });

  for (const entry of data) {
    for (const w of entry.windows) {
      gauge.set({ service: entry.service, window: w.name }, w.utilization);
    }
  }

  return registry.metrics();
}
