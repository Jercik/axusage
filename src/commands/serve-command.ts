/**
 * Serve command handler — starts an HTTP server exposing Prometheus metrics.
 */

import { getServeConfig } from "../config/serve-config.js";
import { selectServicesToQuery } from "./fetch-service-usage.js";
import { fetchServicesInParallel } from "./usage-command.js";
import { formatPrometheusMetrics } from "../utils/format-prometheus-metrics.js";
import { createServer } from "../server/server.js";
import { createHealthRouter, createMetricsRouter } from "../server/routes.js";
import { getAvailableServices } from "../services/service-adapter-registry.js";

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

  const availableServices = getAvailableServices();
  if (
    config.service !== undefined &&
    config.service.toLowerCase() !== "all" &&
    !availableServices.includes(config.service.toLowerCase())
  ) {
    console.error(
      `Unknown service "${config.service}". Supported: ${availableServices.join(", ")}.`,
    );
    if (process.exitCode === undefined) process.exitCode = 1;
    return;
  }

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

    // All services failed → clear cache so /metrics returns 503 instead of
    // serving stale data that could mask outages in Prometheus alerting.
    cachedMetrics =
      successes.length > 0
        ? await formatPrometheusMetrics(successes)
        : undefined;
  }

  // Initial fetch
  console.error(`Fetching initial metrics for: ${servicesToQuery.join(", ")}`);
  await refreshMetrics();

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

  // Graceful shutdown handler — registered before start so signals during
  // startup are handled. process.once ensures at-most-one invocation per signal.
  // Object wrapper lets the shutdown closure reference the interval assigned
  // after server.start(), without needing a reassignable `let`.
  const poll = {
    intervalId: undefined as ReturnType<typeof setInterval> | undefined,
  };

  const shutdown = (): void => {
    console.error("\nShutting down...");
    if (poll.intervalId !== undefined) clearInterval(poll.intervalId);
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

  // Start server first — if this throws (e.g. EADDRINUSE), no polling interval
  // is left dangling keeping the process alive.
  await server.start();

  // Start polling only after a successful listen.
  poll.intervalId = setInterval(() => {
    void refreshMetrics().catch((error: unknown) => {
      console.error("Unexpected error during metrics refresh:", error);
    });
  }, config.intervalMs);

  console.error(
    `Polling every ${String(config.intervalMs / 1000)}s for: ${servicesToQuery.join(", ")}`,
  );
}
