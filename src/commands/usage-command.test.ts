import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Result, ServiceUsageData } from "../types/domain.js";
import { ApiError } from "../types/domain.js";

// Mock dependencies before importing the module under test
vi.mock("./fetch-service-usage.js", () => ({
  fetchServiceUsage: vi.fn(),
  selectServicesToQuery: vi.fn((service?: string) =>
    service === "all" || !service
      ? ["claude", "chatgpt", "github-copilot"]
      : [service],
  ),
}));

vi.mock("./fetch-service-usage-with-reauth.js", () => ({
  fetchServiceUsageWithAutoReauth: vi.fn(),
}));

vi.mock("./run-auth-setup.js", () => ({
  isAuthFailure: vi.fn(
    (result: Result<ServiceUsageData, ApiError>) =>
      !result.ok &&
      Boolean(result.error.message) &&
      [
        /\bauthentication\s+failed\b/iu,
        /\bno\s+saved\s+authentication\b/iu,
        /\b401\b/u,
        /\bunauthorized\b/iu,
        /\bsession\s+expired\b/iu,
        /\blogin\s+required\b/iu,
        /\bcredentials?\s+(expired|invalid)\b/iu,
      ].some((pattern) => pattern.test(result.error.message)),
  ),
}));

vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

// Import after mocking
import { fetchServicesWithHybridStrategy } from "./usage-command.js";
import { fetchServiceUsage } from "./fetch-service-usage.js";
import { fetchServiceUsageWithAutoReauth } from "./fetch-service-usage-with-reauth.js";

const mockFetchServiceUsage = vi.mocked(fetchServiceUsage);
const mockFetchServiceUsageWithAutoReauth = vi.mocked(
  fetchServiceUsageWithAutoReauth,
);

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

describe("fetchServicesWithHybridStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful parallel fetch (no auth errors)", () => {
    it("returns all results from parallel fetch", async () => {
      mockFetchServiceUsage
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("claude"),
        })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("chatgpt"),
        });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        service: "claude",
        result: { ok: true, value: createMockUsageData("claude") },
      });
      expect(results[1]).toEqual({
        service: "chatgpt",
        result: { ok: true, value: createMockUsageData("chatgpt") },
      });
      expect(mockFetchServiceUsageWithAutoReauth).not.toHaveBeenCalled();
    });

    it("returns non-auth errors without retry", async () => {
      const networkError = new ApiError("Network timeout", 500);
      mockFetchServiceUsage
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("claude"),
        })
        .mockResolvedValueOnce({ ok: false, error: networkError });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.result.ok).toBe(true);
      expect(results[1]?.result.ok).toBe(false);
      expect(mockFetchServiceUsageWithAutoReauth).not.toHaveBeenCalled();
    });
  });

  describe("handling auth failures with sequential retries", () => {
    it("retries auth failures sequentially", async () => {
      const authError = new ApiError("401 Unauthorized", 401);
      mockFetchServiceUsage
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("claude"),
        })
        .mockResolvedValueOnce({ ok: false, error: authError });
      mockFetchServiceUsageWithAutoReauth.mockResolvedValueOnce({
        service: "chatgpt",
        result: { ok: true, value: createMockUsageData("chatgpt") },
      });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]?.result.ok).toBe(true);
      expect(results[1]?.result.ok).toBe(true);
      expect(mockFetchServiceUsageWithAutoReauth).toHaveBeenCalledTimes(1);
      expect(mockFetchServiceUsageWithAutoReauth).toHaveBeenCalledWith(
        "chatgpt",
      );
    });

    it("retries multiple auth failures sequentially", async () => {
      const authError = new ApiError("Authentication failed", 401);
      mockFetchServiceUsage
        .mockResolvedValueOnce({ ok: false, error: authError })
        .mockResolvedValueOnce({ ok: false, error: authError })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("github-copilot"),
        });
      mockFetchServiceUsageWithAutoReauth
        .mockResolvedValueOnce({
          service: "claude",
          result: { ok: true, value: createMockUsageData("claude") },
        })
        .mockResolvedValueOnce({
          service: "chatgpt",
          result: { ok: true, value: createMockUsageData("chatgpt") },
        });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
        "github-copilot",
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.result.ok)).toBe(true);
      expect(mockFetchServiceUsageWithAutoReauth).toHaveBeenCalledTimes(2);
    });
  });

  describe("merging results correctly after retries", () => {
    it("replaces auth failures with retry results", async () => {
      const authError = new ApiError("Session expired", 401);
      mockFetchServiceUsage
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("claude"),
        })
        .mockResolvedValueOnce({ ok: false, error: authError })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("github-copilot"),
        });

      const baseWindow = createMockUsageData("chatgpt").windows[0];
      const retryData: ServiceUsageData = {
        ...createMockUsageData("chatgpt"),
        windows: baseWindow ? [{ ...baseWindow, utilization: 75 }] : [],
      };
      mockFetchServiceUsageWithAutoReauth.mockResolvedValueOnce({
        service: "chatgpt",
        result: { ok: true, value: retryData },
      });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
        "github-copilot",
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]?.service).toBe("claude");
      expect(results[1]?.service).toBe("chatgpt");
      expect(results[2]?.service).toBe("github-copilot");
      // Verify retry result replaced original auth failure
      expect(results[1]?.result.ok).toBe(true);
    });

    it("preserves order after merging", async () => {
      const authError = new ApiError("Unauthorized", 401);
      mockFetchServiceUsage
        .mockResolvedValueOnce({ ok: false, error: authError })
        .mockResolvedValueOnce({
          ok: true,
          value: createMockUsageData("chatgpt"),
        })
        .mockResolvedValueOnce({ ok: false, error: authError });
      mockFetchServiceUsageWithAutoReauth
        .mockResolvedValueOnce({
          service: "claude",
          result: { ok: true, value: createMockUsageData("claude") },
        })
        .mockResolvedValueOnce({
          service: "github-copilot",
          result: { ok: true, value: createMockUsageData("github-copilot") },
        });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
        "github-copilot",
      ]);

      expect(results.map((r) => r.service)).toEqual([
        "claude",
        "chatgpt",
        "github-copilot",
      ]);
    });
  });

  describe("edge cases", () => {
    it("handles all services failing authentication", async () => {
      const authError = new ApiError("No saved authentication", 401);
      mockFetchServiceUsage.mockResolvedValue({ ok: false, error: authError });
      mockFetchServiceUsageWithAutoReauth
        .mockResolvedValueOnce({
          service: "claude",
          result: { ok: false, error: authError },
        })
        .mockResolvedValueOnce({
          service: "chatgpt",
          result: { ok: false, error: authError },
        });

      const results = await fetchServicesWithHybridStrategy([
        "claude",
        "chatgpt",
      ]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => !r.result.ok)).toBe(true);
      expect(mockFetchServiceUsageWithAutoReauth).toHaveBeenCalledTimes(2);
    });

    it("handles empty services list", async () => {
      const results = await fetchServicesWithHybridStrategy([]);

      expect(results).toHaveLength(0);
      expect(mockFetchServiceUsage).not.toHaveBeenCalled();
    });

    it("handles single service", async () => {
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: true,
        value: createMockUsageData("claude"),
      });

      const results = await fetchServicesWithHybridStrategy(["claude"]);

      expect(results).toHaveLength(1);
      expect(results[0]?.service).toBe("claude");
    });
  });
});
