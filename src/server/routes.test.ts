import { describe, it, expect } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { createHealthRouter, createMetricsRouter } from "./routes.js";

/**
 * Starts an Express app on a random OS-assigned port (port 0) and returns a
 * base URL and a cleanup function. Using port 0 avoids collisions with other
 * processes; the OS picks a free port and reports the actual one via address().
 */
async function startTestApp(app: express.Express): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  return new Promise((resolve, reject) => {
    const srv = app.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((resolve, reject) => {
            srv.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          }),
      });
    });
    srv.on("error", reject);
  });
}

describe("createHealthRouter", () => {
  it("returns 200 with ok status and service info", async () => {
    const now = new Date();
    const app = express();
    app.use(
      createHealthRouter(() => ({
        lastRefreshTime: now,
        services: ["claude", "gemini"],
        errors: [],
        hasMetrics: true,
      })),
    );

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.status).toBe("ok");
      expect(body.services).toEqual(["claude", "gemini"]);
      expect(body.errors).toEqual([]);
      expect(body.lastRefresh).toBe(now.toISOString());
    } finally {
      await close();
    }
  });

  it("returns 503 with degraded status when no metrics are available", async () => {
    const app = express();
    app.use(
      createHealthRouter(() => ({
        lastRefreshTime: new Date(),
        services: ["claude"],
        errors: ["claude: fetch failed (HTTP 401)"],
        hasMetrics: false,
      })),
    );

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(503);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.status).toBe("degraded");
      expect(body.errors).toEqual(["claude: fetch failed (HTTP 401)"]);
    } finally {
      await close();
    }
  });

  it("omits lastRefresh when lastRefreshTime is undefined", async () => {
    const app = express();
    app.use(
      createHealthRouter(() => ({
        lastRefreshTime: undefined,
        services: ["claude"],
        errors: ["claude: fetch failed"],
        hasMetrics: false,
      })),
    );

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/health`);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.lastRefresh).toBeUndefined();
      expect(body.errors).toEqual(["claude: fetch failed"]);
    } finally {
      await close();
    }
  });
});

describe("createMetricsRouter", () => {
  it("returns 503 when no metrics are cached yet", async () => {
    const app = express();
    app.use(createMetricsRouter(() => ({ metrics: undefined })));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/metrics`);
      expect(response.status).toBe(503);
    } finally {
      await close();
    }
  });

  it("returns 200 with Prometheus content-type when metrics are available", async () => {
    const metricsText =
      '# TYPE axusage_utilization_percent gauge\naxusage_utilization_percent{service="claude",window="5h"} 42\n';
    const app = express();
    app.use(createMetricsRouter(() => ({ metrics: metricsText })));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      const body = await response.text();
      expect(body).toBe(metricsText);
    } finally {
      await close();
    }
  });
});
