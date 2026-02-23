/**
 * Route handlers for axusage serve mode.
 */

import { Router } from "express";

import packageJson from "../../package.json" with { type: "json" };
import type { ServiceUsageData } from "../types/domain.js";
import { formatPrometheusMetrics } from "../utils/format-prometheus-metrics.js";

/** Snapshot produced by each refresh cycle. */
export type ServerState = {
  readonly usage: readonly ServiceUsageData[];
  readonly refreshedAt: Date;
  readonly errors: readonly string[];
};

/** Create router for GET /health */
export function createHealthRouter(
  services: readonly string[],
  getState: () => ServerState | undefined,
): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    const state = getState();
    const healthy = state !== undefined && state.usage.length > 0;
    response.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      version: packageJson.version,
      lastRefresh: state?.refreshedAt.toISOString(),
      services,
      errors: state?.errors ?? [],
    });
  });

  return router;
}

/** Create router for GET /metrics (Prometheus text exposition) */
export function createMetricsRouter(
  getFreshState: () => Promise<ServerState | undefined>,
): Router {
  const router = Router();

  // Memoize the rendered Prometheus text by the state snapshot's refreshedAt
  // timestamp. Scrapes within the same cache window reuse the same Promise,
  // avoiding recreating prom-client Registry/Gauge objects on each request.
  // Assignments happen synchronously (before any await) so require-atomic-updates
  // is satisfied and concurrent scrapes naturally coalesce onto one render.
  let memoFor: Date | undefined;
  let memoPromise: Promise<string> = Promise.resolve("");

  router.get("/metrics", async (_request, response) => {
    const state = await getFreshState();
    const usage = state?.usage;
    if (!usage || usage.length === 0) {
      response.status(503).type("text/plain").send("No data yet\n");
      return;
    }
    if (memoFor !== state.refreshedAt) {
      memoFor = state.refreshedAt;
      memoPromise = formatPrometheusMetrics(usage);
    }
    const text = await memoPromise;
    response
      .status(200)
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(text);
  });

  return router;
}

/** Create router for GET /usage (JSON) */
export function createUsageRouter(
  getFreshState: () => Promise<ServerState | undefined>,
): Router {
  const router = Router();

  router.get("/usage", async (_request, response) => {
    const state = await getFreshState();
    const usage = state?.usage;
    if (!usage || usage.length === 0) {
      response.status(503).json({ error: "No data yet" });
      return;
    }
    response.status(200).json(usage);
  });

  return router;
}
