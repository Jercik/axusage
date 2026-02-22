import { describe, it, expect } from "vitest";
import net, { type AddressInfo } from "node:net";
import { createServer } from "./server.js";

/**
 * Asks the OS for a free TCP port by briefly binding to port 0, then releases it.
 * The returned port is free at the moment of the call; a race is theoretically
 * possible but negligible in practice for local tests.
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => {
        resolve(port);
      });
    });
    srv.on("error", reject);
  });
}

describe("createServer", () => {
  it("starts, responds to requests, then stops cleanly", async () => {
    const port = await getFreePort();
    const server = createServer({ port, host: "127.0.0.1" }, []);

    await server.start();

    try {
      // 404 handler confirms the server is responding
      const response = await fetch(`http://127.0.0.1:${port}/any-path`);
      expect(response.status).toBe(404);
    } finally {
      await server.stop();
    }
  });

  it("stop() before start() resolves without error", async () => {
    const server = createServer({ port: 3000, host: "127.0.0.1" }, []);
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("stop() is idempotent — safe to call multiple times", async () => {
    const port = await getFreePort();
    const server = createServer({ port, host: "127.0.0.1" }, []);

    await server.start();
    await server.stop();
    // Second stop() should not throw or reject
    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("start() rejects when server is already running", async () => {
    const port = await getFreePort();
    const server = createServer({ port, host: "127.0.0.1" }, []);

    await server.start();
    try {
      await expect(server.start()).rejects.toThrowError("already running");
    } finally {
      await server.stop();
    }
  });
});
