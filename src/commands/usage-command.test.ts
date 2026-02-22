import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../types/domain.js";
import type { ServiceUsageData } from "../types/domain.js";

vi.mock("./fetch-service-usage.js", () => ({
  fetchServiceUsage: vi.fn(),
  selectServicesToQuery: vi.fn((service?: string) =>
    service === "all" || !service ? ["claude", "codex", "copilot"] : [service],
  ),
}));

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

import { fetchServicesInParallel, usageCommand } from "./usage-command.js";
import { fetchServiceUsage } from "./fetch-service-usage.js";

const mockFetchServiceUsage = vi.mocked(fetchServiceUsage);

const createMockUsageData = (service: string): ServiceUsageData => ({
  service,
  planType: "free",
  windows: [
    {
      name: "Daily",
      utilization: 50,
      resetsAt: new Date("2025-01-01T00:00:00Z"),
      periodDurationMs: 86_400_000,
    },
  ],
});

describe("fetchServicesInParallel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  it("returns successful results in requested order", async () => {
    mockFetchServiceUsage
      .mockResolvedValueOnce({
        ok: true,
        value: createMockUsageData("claude"),
      })
      .mockResolvedValueOnce({
        ok: true,
        value: createMockUsageData("codex"),
      });

    const results = await fetchServicesInParallel(["claude", "codex"]);

    expect(results).toEqual([
      {
        service: "claude",
        result: { ok: true, value: createMockUsageData("claude") },
      },
      {
        service: "codex",
        result: { ok: true, value: createMockUsageData("codex") },
      },
    ]);
    expect(mockFetchServiceUsage).toHaveBeenCalledTimes(2);
  });

  it("returns auth failures without retries", async () => {
    const authError = new ApiError("401 Unauthorized", 401);
    mockFetchServiceUsage.mockResolvedValueOnce({
      ok: false,
      error: authError,
    });

    const results = await fetchServicesInParallel(["claude"]);

    expect(results).toEqual([
      {
        service: "claude",
        result: { ok: false, error: authError },
      },
    ]);
    expect(mockFetchServiceUsage).toHaveBeenCalledTimes(1);
  });

  it("returns mixed successes and non-auth failures", async () => {
    const networkError = new ApiError("Network timeout", 500);
    mockFetchServiceUsage
      .mockResolvedValueOnce({
        ok: true,
        value: createMockUsageData("claude"),
      })
      .mockResolvedValueOnce({
        ok: false,
        error: networkError,
      });

    const results = await fetchServicesInParallel(["claude", "codex"]);

    expect(results).toEqual([
      {
        service: "claude",
        result: { ok: true, value: createMockUsageData("claude") },
      },
      {
        service: "codex",
        result: { ok: false, error: networkError },
      },
    ]);
    expect(mockFetchServiceUsage).toHaveBeenCalledTimes(2);
  });

  it("handles an empty service list", async () => {
    const results = await fetchServicesInParallel([]);

    expect(results).toEqual([]);
    expect(mockFetchServiceUsage).not.toHaveBeenCalled();
  });
});

describe("usageCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
    process.exitCode = undefined;
  });

  it("does not retry auth failures and prints CLI auth guidance", async () => {
    const authError = new ApiError("401 Unauthorized", 401);
    mockFetchServiceUsage.mockResolvedValueOnce({
      ok: false,
      error: authError,
    });

    await usageCommand({ service: "claude", format: "text" });

    expect(mockFetchServiceUsage).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Authentication required for: claude."),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--auth-setup <service>"),
    );
    expect(process.exitCode).toBe(1);
  });
});
