import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUsageCache } from "./serve-command.js";
import { ApiError } from "../types/domain.js";
import type { ServiceResult } from "../types/domain.js";

const makeSuccess = (service: string): ServiceResult => ({
  service,
  result: {
    ok: true,
    value: {
      service,
      windows: [
        {
          name: "monthly",
          utilization: 50,
          resetsAt: undefined,
          periodDurationMs: 0,
        },
      ],
    },
  },
});

const makeFailure = (service: string): ServiceResult => ({
  service,
  result: { ok: false, error: new ApiError("timeout") },
});

describe("createUsageCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("getState is undefined before first fetch", () => {
    const cache = createUsageCache(vi.fn(), 300_000);
    expect(cache.getState()).toBeUndefined();
  });

  it("fetches on first getFreshState call", async () => {
    const fetch = vi.fn().mockResolvedValue([makeSuccess("claude")]);
    const cache = createUsageCache(fetch, 300_000);

    const state = await cache.getFreshState();
    expect(fetch).toHaveBeenCalledOnce();
    expect(state?.usage).toHaveLength(1);
    expect(state?.usage.at(0)?.service).toBe("claude");
  });

  it("serves from cache when within max age", async () => {
    const fetch = vi.fn().mockResolvedValue([makeSuccess("claude")]);
    const cache = createUsageCache(fetch, 300_000);

    await cache.getFreshState();
    vi.advanceTimersByTime(299_999);
    await cache.getFreshState();

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("refreshes after max age expires", async () => {
    const fetch = vi.fn().mockResolvedValue([makeSuccess("claude")]);
    const cache = createUsageCache(fetch, 300_000);

    await cache.getFreshState();
    vi.advanceTimersByTime(300_001);
    await cache.getFreshState();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent refresh requests onto a single fetch", async () => {
    let resolveInner!: () => void;
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Promise<ServiceResult[]>((resolve) => {
          resolveInner = () => {
            resolve([makeSuccess("claude")]);
          };
        }),
    );
    const cache = createUsageCache(fetch, 300_000);

    const [p1, p2, p3] = [
      cache.getFreshState(),
      cache.getFreshState(),
      cache.getFreshState(),
    ];
    resolveInner();
    await Promise.all([p1, p2, p3]);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("retries quickly when all services fail", async () => {
    const fetch = vi.fn().mockResolvedValue([makeFailure("claude")]);
    const cache = createUsageCache(fetch, 300_000);

    await cache.getFreshState();
    vi.advanceTimersByTime(5001);
    await cache.getFreshState();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry within short backoff when all services fail", async () => {
    const fetch = vi.fn().mockResolvedValue([makeFailure("claude")]);
    const cache = createUsageCache(fetch, 300_000);

    await cache.getFreshState();
    vi.advanceTimersByTime(4999);
    await cache.getFreshState();

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("records partial failures in state errors while keeping successful usage", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue([makeSuccess("claude"), makeFailure("codex")]);
    const cache = createUsageCache(fetch, 300_000);

    const state = await cache.getFreshState();
    expect(state?.usage).toHaveLength(1);
    expect(state?.usage.at(0)?.service).toBe("claude");
    expect(state?.errors).toHaveLength(1);
    expect(state?.errors.at(0)).toContain("codex");
  });
});
