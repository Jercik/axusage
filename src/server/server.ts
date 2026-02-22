/**
 * Express HTTP server for axusage metrics.
 *
 * Designed for both CLI and library usage via factory pattern.
 */

import type { Server } from "node:http";

import express, { type Express, type Router } from "express";

import type { ServeConfig } from "../config/serve-config.js";

/** Server instance with lifecycle methods */
type AxusageServer = {
  /** The Express application instance */
  readonly app: Express;
  /** Start listening on the configured host:port */
  start(): Promise<void>;
  /** Stop the server gracefully */
  stop(): Promise<void>;
};

/** Create and configure Express application */
function createApp(routers: Router[]): Express {
  const app = express();

  // Security: disable X-Powered-By header
  app.disable("x-powered-by");

  // Register all routers
  for (const router of routers) {
    app.use(router);
  }

  // 404 handler for unmatched routes
  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  return app;
}

/** Create an axusage server instance */
export function createServer(
  config: Pick<ServeConfig, "port" | "host">,
  routers: Router[],
): AxusageServer {
  const app = createApp(routers);
  let server: Server | undefined;
  let stopPromise: Promise<void> | undefined;

  return {
    app,

    start(): Promise<void> {
      stopPromise = undefined;

      return new Promise((resolve, reject) => {
        const onStartupError = (error: Error): void => {
          reject(error);
        };

        server = app.listen(config.port, config.host, () => {
          server?.removeListener("error", onStartupError);

          server?.on("error", (error: Error) => {
            console.error("Server error:", error);
          });

          console.error(
            `axusage listening on http://${config.host}:${String(config.port)}`,
          );
          resolve();
        });

        server.once("error", onStartupError);
      });
    },

    stop(): Promise<void> {
      if (stopPromise) {
        return stopPromise;
      }

      if (!server) {
        return Promise.resolve();
      }

      const serverToClose = server;
      server = undefined;

      stopPromise = new Promise((resolve, reject) => {
        serverToClose.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      return stopPromise;
    },
  };
}
