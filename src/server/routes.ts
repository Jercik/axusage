/**
 * Route handlers for axusage serve mode.
 */

import { Router } from "express";

import packageJson from "../../package.json" with { type: "json" };

type HealthStatus = {
  readonly lastRefreshTime: Date | undefined;
  readonly services: readonly string[];
  readonly errors: readonly string[];
};

type MetricsStatus = {
  readonly metrics: string | undefined;
};

/** Create router for GET /health */
export function createHealthRouter(getStatus: () => HealthStatus): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    const status = getStatus();
    response.json({
      status: "ok",
      version: packageJson.version,
      lastRefresh: status.lastRefreshTime?.toISOString(),
      services: status.services,
      errors: status.errors,
    });
  });

  return router;
}

/** Create router for GET /metrics */
export function createMetricsRouter(getMetrics: () => MetricsStatus): Router {
  const router = Router();

  router.get("/metrics", (_request, response) => {
    const { metrics } = getMetrics();
    if (!metrics) {
      response.status(503).type("text/plain").send("No data yet\n");
      return;
    }
    response
      .status(200)
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(metrics);
  });

  return router;
}
