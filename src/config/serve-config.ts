/**
 * Configuration for axusage serve mode.
 *
 * Priority: CLI flags > environment variables > defaults.
 */

export type ServeConfig = {
  readonly port: number;
  readonly host: string;
  readonly intervalMs: number;
  readonly service: string | undefined;
};

type ServeConfigOverrides = {
  readonly port?: string;
  readonly host?: string;
  readonly interval?: string;
  readonly service?: string;
};

const DEFAULT_PORT = 3848;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_INTERVAL_SECONDS = 300; // 5 minutes

/** Parse serve config from environment and CLI overrides */
export function getServeConfig(
  overrides: ServeConfigOverrides = {},
): ServeConfig {
  const port = parsePort(overrides.port ?? process.env.AXUSAGE_PORT);
  const host = overrides.host ?? process.env.AXUSAGE_HOST ?? DEFAULT_HOST;
  const intervalSeconds = parsePositiveInt(
    overrides.interval ?? process.env.AXUSAGE_INTERVAL,
    DEFAULT_INTERVAL_SECONDS,
    "AXUSAGE_INTERVAL",
  );

  const service =
    (overrides.service ?? process.env.AXUSAGE_SERVICE) || undefined;

  return {
    port,
    host,
    intervalMs: intervalSeconds * 1000,
    service,
  };
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function parsePositiveInt(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(
      `Invalid ${name} value "${value}", using default ${String(defaultValue)}`,
    );
    return defaultValue;
  }
  return parsed;
}
