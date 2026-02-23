/**
 * Serve command handler — starts an HTTP server exposing usage data.
 */

import { getServeConfig } from "../config/serve-config.js";
import { selectServicesToQuery } from "./fetch-service-usage.js";
import { fetchServicesInParallel } from "./usage-command.js";
import { createServer } from "../server/server.js";
import {
  createHealthRouter,
  createMetricsRouter,
  createUsageRouter,
  type ServerState,
} from "../server/routes.js";
import { getAvailableServices } from "../services/service-adapter-registry.js";
import type { ServiceResult, ServiceUsageData } from "../types/domain.js";

type ServeCommandOptions = {
  readonly port?: string;
  readonly host?: string;
  readonly interval?: string;
  readonly service?: string;
};

type UsageCache = {
  readonly getState: () => ServerState | undefined;
  /** Waits for a fresh snapshot before returning. Use for data endpoints where staleness is unacceptable. */
  readonly getFreshState: () => Promise<ServerState | undefined>;
  /** Serves the current snapshot immediately; triggers a background refresh when stale.
   *  Blocks only if no snapshot exists yet (first ever request). Use for Prometheus /metrics
   *  where scrape latency matters more than strict freshness. */
  readonly getStateStaleWhileRevalidate: () => Promise<ServerState | undefined>;
};

/**
 * Creates an on-demand usage cache. Data is fetched via `doFetch` when a
 * caller requests fresh state and the cached snapshot is older than `intervalMs`.
 * Concurrent callers during a refresh all receive the same in-flight promise.
 * When all services fail, the cache retries after a short backoff (≤5s) rather
 * than waiting the full interval.
 */
export function createUsageCache(
  doFetch: () => Promise<ServiceResult[]>,
  intervalMs: number,
): UsageCache {
  let state: ServerState | undefined;
  let refreshPromise: Promise<void> | undefined;

  async function doRefresh(): Promise<void> {
    const results = await doFetch();

    const usage: ServiceUsageData[] = [];
    const errors: string[] = [];

    for (const { service, result } of results) {
      if (result.ok) {
        usage.push(result.value);
      } else {
        const statusSuffix =
          result.error.status === undefined
            ? ""
            : ` (HTTP ${String(result.error.status)})`;
        errors.push(`${service}: fetch failed${statusSuffix}`);
        console.error(
          `Warning: Failed to fetch ${service}: ${result.error.message}`,
        );
      }
    }

    state = { usage, refreshedAt: new Date(), errors };
  }

  function ensureFresh(): Promise<void> {
    const age =
      state === undefined ? Infinity : Date.now() - state.refreshedAt.getTime();
    // If the last refresh produced no data (all services failed), retry on a
    // short backoff so the server recovers promptly after transient failures
    // rather than waiting the full cache interval.
    const hasData = state !== undefined && state.usage.length > 0;
    const maxAge = hasData ? intervalMs : Math.min(intervalMs, 5000);
    if (age < maxAge) return Promise.resolve();
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = undefined;
    });
    return refreshPromise;
  }

  return {
    getState: () => state,
    getFreshState: async () => {
      await ensureFresh();
      return state;
    },
    getStateStaleWhileRevalidate: async () => {
      if (state === undefined) {
        // No snapshot yet — block until we have something to serve.
        await ensureFresh();
      } else {
        // Serve the current snapshot immediately; kick off a background
        // refresh if stale. Errors are logged; callers are not affected.
        void ensureFresh().catch((error: unknown) => {
          console.error("Background metrics refresh failed:", error);
        });
      }
      return state;
    },
  };
}

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

  const cache = createUsageCache(
    () => fetchServicesInParallel(servicesToQuery),
    config.intervalMs,
  );

  const server = createServer(config, [
    createHealthRouter(servicesToQuery, cache.getState),
    createMetricsRouter(cache.getStateStaleWhileRevalidate),
    createUsageRouter(cache.getFreshState),
  ]);

  const shutdown = (): void => {
    console.error("\nShutting down...");

    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out, forcing exit");
      // eslint-disable-next-line unicorn/no-process-exit -- CLI graceful shutdown
      process.exit(1);
    }, 5000);
    forceExit.unref();

    server
      .stop()
      .finally(() => {
        clearTimeout(forceExit);
      })
      .then(
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

  // Pre-populate the cache before accepting connections so /health returns a
  // meaningful status immediately (important for container readiness checks).
  console.error(`Fetching initial data for: ${servicesToQuery.join(", ")}`);
  await cache.getFreshState();

  await server.start();

  console.error(
    `Serving usage for: ${servicesToQuery.join(", ")} (max age: ${String(config.intervalMs / 1000)}s)`,
  );
}
