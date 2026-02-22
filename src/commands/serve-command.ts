/**
 * Serve command handler — starts an HTTP server exposing Prometheus metrics.
 */

import { getServeConfig } from "../config/serve-config.js";
import { selectServicesToQuery } from "./fetch-service-usage.js";
import { fetchServicesInParallel } from "./usage-command.js";
import { formatPrometheusMetrics } from "../utils/format-prometheus-metrics.js";
import { createServer } from "../server/server.js";
import { createHealthRouter, createMetricsRouter } from "../server/routes.js";

type ServeCommandOptions = {
  readonly port?: string;
  readonly host?: string;
  readonly interval?: string;
  readonly service?: string;
};

export async function serveCommand(
  options: ServeCommandOptions,
): Promise<void> {
  const config = getServeConfig(options);
  const servicesToQuery = selectServicesToQuery(config.service);

  // Cached state
  let cachedMetrics: string | undefined;
  let lastRefreshTime: Date | undefined;
  let lastRefreshErrors: string[] = [];

  async function refreshMetrics(): Promise<void> {
    const results = await fetchServicesInParallel(servicesToQuery);

    const successes = [];
    const errors: string[] = [];

    for (const { service, result } of results) {
      if (result.ok) {
        successes.push(result.value);
      } else {
        errors.push(`${service}: ${result.error.message}`);
        console.error(
          `Warning: Failed to fetch ${service}: ${result.error.message}`,
        );
      }
    }

    lastRefreshErrors = errors;
    lastRefreshTime = new Date();

    if (successes.length > 0) {
      cachedMetrics = await formatPrometheusMetrics(successes);
    }
  }

  // Initial fetch
  console.error(`Fetching initial metrics for: ${servicesToQuery.join(", ")}`);
  await refreshMetrics();

  // Start polling
  const intervalId = setInterval(() => {
    void refreshMetrics();
  }, config.intervalMs);

  // Create server
  const healthRouter = createHealthRouter(() => ({
    lastRefreshTime,
    services: servicesToQuery,
    errors: lastRefreshErrors,
  }));

  const metricsRouter = createMetricsRouter(() => ({
    metrics: cachedMetrics,
  }));

  const server = createServer(config, [healthRouter, metricsRouter]);

  // Graceful shutdown handler
  const shutdown = (): void => {
    console.error("\nShutting down...");
    clearInterval(intervalId);
    server.stop().then(
      () => {
        // eslint-disable-next-line unicorn/no-process-exit -- CLI graceful shutdown
        process.exit(0);
      },
      (error: unknown) => {
        console.error("Error during shutdown:", error);
        // eslint-disable-next-line unicorn/no-process-exit -- CLI graceful shutdown
        process.exit(1);
      },
    );
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  await server.start();

  console.error(
    `Polling every ${String(config.intervalMs / 1000)}s for: ${servicesToQuery.join(", ")}`,
  );
}
