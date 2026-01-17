import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, Record<string, unknown>>();

class ConfigMock<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly key: string;

  static shouldThrowOnConstruct = false;

  constructor(options: {
    projectName: string;
    projectSuffix?: string;
    schema?: unknown;
  }) {
    if (ConfigMock.shouldThrowOnConstruct) {
      throw new Error("mock construct failure");
    }
    const suffix = options.projectSuffix ?? "-nodejs";
    this.key = `${options.projectName}${suffix}`;
    if (!store.has(this.key)) {
      store.set(this.key, {});
    }
  }

  get path(): string {
    return `/mock/${this.key}/config.json`;
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    const data = store.get(this.key) ?? {};
    return data[key as string] as T[K] | undefined;
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const data = store.get(this.key) ?? {};
    data[key as string] = value;
    store.set(this.key, data);
  }
}

vi.mock("conf", () => ({
  default: ConfigMock,
}));

describe("credential sources migration", () => {
  beforeEach(() => {
    store.clear();
    ConfigMock.shouldThrowOnConstruct = false;
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("migrates legacy sources when new config is empty", async () => {
    store.set("axusage-nodejs", {
      sources: { claude: "vault" },
    });

    const { getServiceSourceConfig } = await import("./credential-sources.js");

    expect(getServiceSourceConfig("claude")).toEqual({
      source: "vault",
      name: undefined,
    });
  });

  it("does not overwrite existing new config values", async () => {
    store.set("axusage", {
      sources: { claude: "local" },
    });
    store.set("axusage-nodejs", {
      sources: { claude: "vault" },
    });

    const { getServiceSourceConfig } = await import("./credential-sources.js");

    expect(getServiceSourceConfig("claude")).toEqual({
      source: "local",
      name: undefined,
    });
  });

  it("returns the config file path without throwing", async () => {
    const { getCredentialSourcesPath } =
      await import("./credential-sources.js");
    expect(getCredentialSourcesPath()).toBe("/mock/axusage/config.json");
  });

  it("returns a fallback path if Conf throws", async () => {
    ConfigMock.shouldThrowOnConstruct = true;
    const { getCredentialSourcesPath } =
      await import("./credential-sources.js");
    expect(getCredentialSourcesPath()).toBe("(error reading config path)");
  });
});
