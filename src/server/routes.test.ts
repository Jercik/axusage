import { describe, it, expect } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  createHealthRouter,
  createMetricsRouter,
  createUsageRouter,
  type ServerState,
} from "./routes.js";
import type { ServiceUsageData } from "../types/domain.js";

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

const noState: ServerState | undefined = void 0 as ServerState | undefined;

const testService: ServiceUsageData = {
  service: "claude",
  windows: [
    {
      name: "monthly",
      utilization: 42,
      resetsAt: undefined,
      periodDurationMs: 0,
    },
  ],
};

describe("createHealthRouter", () => {
  it("returns 200 with ok status and service info", async () => {
    const now = new Date();
    const state: ServerState = {
      usage: [testService],
      refreshedAt: now,
      errors: [],
    };
    const app = express();
    app.use(createHealthRouter(["claude", "gemini"], () => state));

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

  it("returns 503 with degraded status when all services failed", async () => {
    const state: ServerState = {
      usage: [],
      refreshedAt: new Date(),
      errors: ["claude: fetch failed (HTTP 401)"],
    };
    const app = express();
    app.use(createHealthRouter(["claude"], () => state));

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

  it("returns 503 with no lastRefresh when state is undefined", async () => {
    const app = express();
    app.use(createHealthRouter(["claude"], () => noState));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(503);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.lastRefresh).toBeUndefined();
      expect(body.errors).toEqual([]);
    } finally {
      await close();
    }
  });
});

describe("createMetricsRouter", () => {
  it("returns 503 when no state is available", async () => {
    const app = express();
    app.use(createMetricsRouter(() => Promise.resolve(noState)));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/metrics`);
      expect(response.status).toBe(503);
    } finally {
      await close();
    }
  });

  it("returns 200 with Prometheus content-type when data is available", async () => {
    const state: ServerState = {
      usage: [testService],
      refreshedAt: new Date(),
      errors: [],
    };
    const app = express();
    app.use(createMetricsRouter(() => Promise.resolve(state)));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/plain");
      const body = await response.text();
      expect(body).toContain("axusage_utilization_percent");
    } finally {
      await close();
    }
  });
});

describe("createUsageRouter", () => {
  it("returns 503 when no state is available", async () => {
    const app = express();
    app.use(createUsageRouter(() => Promise.resolve(noState)));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/usage`);
      expect(response.status).toBe(503);
    } finally {
      await close();
    }
  });

  it("returns 200 with usage JSON when data is available", async () => {
    const state: ServerState = {
      usage: [testService],
      refreshedAt: new Date(),
      errors: [],
    };
    const app = express();
    app.use(createUsageRouter(() => Promise.resolve(state)));

    const { url, close } = await startTestApp(app);
    try {
      const response = await fetch(`${url}/usage`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      const body = await response.json();
      expect(body).toEqual([testService]);
    } finally {
      await close();
    }
  });
});
