import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Result, ServiceUsageData } from "../types/domain.js";
import { ApiError } from "../types/domain.js";

// Mock dependencies before importing the module under test
vi.mock("./fetch-service-usage.js", () => ({
  fetchServiceUsage: vi.fn(),
}));

vi.mock("./run-auth-setup.js", () => ({
  isAuthError: vi.fn((message: string) => {
    const authPatterns = [
      /\bauthentication\s+failed\b/iu,
      /\bno\s+saved\s+authentication\b/iu,
      /\b401\b/u,
      /\bunauthorized\b/iu,
      /\bsession\s+expired\b/iu,
      /\blogin\s+required\b/iu,
      /\bcredentials?\s+(expired|invalid)\b/iu,
    ];
    return authPatterns.some((pattern) => pattern.test(message));
  }),
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
  runAuthSetup: vi.fn(),
}));

vi.mock("../services/supported-service.js", () => ({
  validateService: vi.fn(
    (service: string) => service as "claude" | "chatgpt" | "github-copilot",
  ),
}));

vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

// Import after mocking
import { fetchServiceUsageWithAutoReauth } from "./fetch-service-usage-with-reauth.js";
import { fetchServiceUsage } from "./fetch-service-usage.js";
import { runAuthSetup } from "./run-auth-setup.js";
import { validateService } from "../services/supported-service.js";

const mockFetchServiceUsage = vi.mocked(fetchServiceUsage);
const mockRunAuthSetup = vi.mocked(runAuthSetup);
const mockValidateService = vi.mocked(validateService);

const mockUsageData: ServiceUsageData = {
  service: "claude",
  planType: "free",
  windows: [
    {
      name: "Daily",
      utilization: 50,
      resetsAt: new Date("2025-01-01T00:00:00Z"),
      periodDurationMs: 86_400_000,
    },
  ],
};

describe("fetchServiceUsageWithAutoReauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateService.mockImplementation(
      (service) => service as "claude" | "chatgpt" | "github-copilot",
    );
  });

  describe("successful fetch without auth errors", () => {
    it("returns success result without re-authentication", async () => {
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: true,
        value: mockUsageData,
      });

      const result = await fetchServiceUsageWithAutoReauth("claude", true);

      expect(result).toEqual({
        service: "claude",
        result: { ok: true, value: mockUsageData },
      });
      expect(mockFetchServiceUsage).toHaveBeenCalledTimes(1);
      expect(mockRunAuthSetup).not.toHaveBeenCalled();
    });

    it("returns non-auth error without re-authentication", async () => {
      const networkError = new ApiError("Network timeout", 500);
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: false,
        error: networkError,
      });

      const result = await fetchServiceUsageWithAutoReauth("claude", true);

      expect(result).toEqual({
        service: "claude",
        result: { ok: false, error: networkError },
      });
      expect(mockRunAuthSetup).not.toHaveBeenCalled();
    });
  });

  describe("auth failure triggering re-authentication", () => {
    it("retries after successful re-authentication", async () => {
      const authError = new ApiError("401 Unauthorized", 401);
      mockFetchServiceUsage
        .mockResolvedValueOnce({ ok: false, error: authError })
        .mockResolvedValueOnce({ ok: true, value: mockUsageData });
      mockRunAuthSetup.mockResolvedValueOnce(true);

      const result = await fetchServiceUsageWithAutoReauth("claude", true);

      expect(result).toEqual({
        service: "claude",
        result: { ok: true, value: mockUsageData },
      });
      expect(mockFetchServiceUsage).toHaveBeenCalledTimes(2);
      expect(mockRunAuthSetup).toHaveBeenCalledWith("claude");
    });

    it("does not attempt re-authentication when interactive is false", async () => {
      const authError = new ApiError("401 Unauthorized", 401);
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: false,
        error: authError,
      });

      const result = await fetchServiceUsageWithAutoReauth("claude", false);

      expect(result).toEqual({
        service: "claude",
        result: { ok: false, error: authError },
      });
      expect(mockFetchServiceUsage).toHaveBeenCalledTimes(1);
      expect(mockRunAuthSetup).not.toHaveBeenCalled();
    });

    it("returns original error when re-authentication fails", async () => {
      const authError = new ApiError("Authentication failed", 401);
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: false,
        error: authError,
      });
      mockRunAuthSetup.mockResolvedValueOnce(false);

      const result = await fetchServiceUsageWithAutoReauth("claude", true);

      expect(result).toEqual({
        service: "claude",
        result: { ok: false, error: authError },
      });
      expect(mockFetchServiceUsage).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("handles validation errors distinctly", async () => {
      const authError = new ApiError("No saved authentication", 401);
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: false,
        error: authError,
      });
      mockValidateService.mockImplementationOnce(() => {
        throw new Error("Unsupported service: invalid-service");
      });

      const result = await fetchServiceUsageWithAutoReauth(
        "invalid-service",
        true,
      );

      expect(result).toEqual({
        service: "invalid-service",
        result: { ok: false, error: authError },
      });
    });

    it("handles auth setup errors distinctly", async () => {
      const authError = new ApiError("Session expired", 401);
      mockFetchServiceUsage.mockResolvedValueOnce({
        ok: false,
        error: authError,
      });
      mockRunAuthSetup.mockRejectedValueOnce(
        new Error("Browser launch failed"),
      );

      const result = await fetchServiceUsageWithAutoReauth("claude", true);

      expect(result).toEqual({
        service: "claude",
        result: { ok: false, error: authError },
      });
    });
  });
});
