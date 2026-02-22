import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServeConfig } from "./serve-config.js";

describe("getServeConfig", () => {
  let savedEnvironment: {
    AXUSAGE_PORT: string | undefined;
    AXUSAGE_HOST: string | undefined;
    AXUSAGE_INTERVAL: string | undefined;
  };

  beforeEach(() => {
    savedEnvironment = {
      AXUSAGE_PORT: process.env.AXUSAGE_PORT,
      AXUSAGE_HOST: process.env.AXUSAGE_HOST,
      AXUSAGE_INTERVAL: process.env.AXUSAGE_INTERVAL,
    };
    delete process.env.AXUSAGE_PORT;
    delete process.env.AXUSAGE_HOST;
    delete process.env.AXUSAGE_INTERVAL;
  });

  afterEach(() => {
    if (savedEnvironment.AXUSAGE_PORT === undefined) {
      delete process.env.AXUSAGE_PORT;
    } else {
      process.env.AXUSAGE_PORT = savedEnvironment.AXUSAGE_PORT;
    }
    if (savedEnvironment.AXUSAGE_HOST === undefined) {
      delete process.env.AXUSAGE_HOST;
    } else {
      process.env.AXUSAGE_HOST = savedEnvironment.AXUSAGE_HOST;
    }
    if (savedEnvironment.AXUSAGE_INTERVAL === undefined) {
      delete process.env.AXUSAGE_INTERVAL;
    } else {
      process.env.AXUSAGE_INTERVAL = savedEnvironment.AXUSAGE_INTERVAL;
    }
  });

  it("returns defaults when no overrides or env vars are set", () => {
    const config = getServeConfig();
    expect(config.port).toBe(3848);
    expect(config.host).toBe("127.0.0.1");
    expect(config.intervalMs).toBe(300_000);
    expect(config.service).toBeUndefined();
  });

  it("applies CLI overrides over defaults", () => {
    const config = getServeConfig({
      port: "4000",
      host: "0.0.0.0",
      interval: "60",
      service: "claude",
    });
    expect(config.port).toBe(4000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.intervalMs).toBe(60_000);
    expect(config.service).toBe("claude");
  });

  it("reads port from AXUSAGE_PORT env var", () => {
    process.env.AXUSAGE_PORT = "5000";
    expect(getServeConfig().port).toBe(5000);
  });

  it("reads host from AXUSAGE_HOST env var", () => {
    process.env.AXUSAGE_HOST = "192.168.1.1";
    expect(getServeConfig().host).toBe("192.168.1.1");
  });

  it("reads interval from AXUSAGE_INTERVAL env var", () => {
    process.env.AXUSAGE_INTERVAL = "120";
    expect(getServeConfig().intervalMs).toBe(120_000);
  });

  it("CLI overrides take precedence over env vars", () => {
    process.env.AXUSAGE_PORT = "5000";
    process.env.AXUSAGE_HOST = "192.168.1.1";
    process.env.AXUSAGE_INTERVAL = "120";
    const config = getServeConfig({
      port: "9999",
      host: "10.0.0.1",
      interval: "30",
    });
    expect(config.port).toBe(9999);
    expect(config.host).toBe("10.0.0.1");
    expect(config.intervalMs).toBe(30_000);
  });

  it("throws on an out-of-range port", () => {
    expect(() => getServeConfig({ port: "99999" })).toThrowError(
      "Invalid port",
    );
    expect(() => getServeConfig({ port: "0" })).toThrowError("Invalid port");
  });

  it("throws on a non-numeric port", () => {
    expect(() => getServeConfig({ port: "abc" })).toThrowError("Invalid port");
  });

  it("throws on a partially numeric port string", () => {
    expect(() => getServeConfig({ port: "3848abc" })).toThrowError(
      "Invalid port",
    );
  });

  it("falls back to default interval for partially numeric interval string", () => {
    process.env.AXUSAGE_INTERVAL = "60sec";
    expect(getServeConfig().intervalMs).toBe(300_000);
  });

  it("falls back to default interval when AXUSAGE_INTERVAL is invalid", () => {
    process.env.AXUSAGE_INTERVAL = "abc";
    expect(getServeConfig().intervalMs).toBe(300_000);
  });

  it("falls back to default interval when AXUSAGE_INTERVAL is zero", () => {
    process.env.AXUSAGE_INTERVAL = "0";
    expect(getServeConfig().intervalMs).toBe(300_000);
  });
});
