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
import type { ServiceUsageData } from "../types/domain.js";

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

  let state: ServerState | undefined;
  let refreshPromise: Promise<void> | undefined;

  async function doRefresh(): Promise<void> {
    const results = await fetchServicesInParallel(servicesToQuery);

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
    const maxAge = hasData
      ? config.intervalMs
      : Math.min(config.intervalMs, 5000);
    if (age < maxAge) return Promise.resolve();
    refreshPromise ??= doRefresh().finally(() => {
      refreshPromise = undefined;
    });
    return refreshPromise;
  }

  const getState = () => state;
  const getFreshState = async () => {
    await ensureFresh();
    return state;
  };

  const server = createServer(config, [
    createHealthRouter(servicesToQuery, getState),
    createMetricsRouter(getFreshState),
    createUsageRouter(getFreshState),
  ]);

  const shutdown = (): void => {
    console.error("\nShutting down...");

    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out, forcing exit");
      // eslint-disable-next-line unicorn/no-process-exit -- CLI graceful shutdown
      process.exit(1);
    }, 5000);
    forceExit.unref();

    server.stop().then(
      () => {
        clearTimeout(forceExit);
        // eslint-disable-next-line unicorn/no-process-exit -- CLI graceful shutdown
        process.exit(0);
      },
      (error: unknown) => {
        clearTimeout(forceExit);
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
    `Serving usage for: ${servicesToQuery.join(", ")} (max age: ${String(config.intervalMs / 1000)}s)`,
  );
}
