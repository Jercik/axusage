import { describe, it, expect } from "vitest";
import { chatGPTAdapter } from "./chatgpt.js";
import { withMockFetch } from "../test-utils/mock-fetch.js";
import type { Result, ServiceUsageData, ApiError } from "#types/domain";

describe("ChatGPT Adapter", () => {
  describe("fetchUsage", () => {
    it("should convert ChatGPT API response to common format", async () => {
      // Actual response from example-requests/codex-usage HAR file
      const mockCodexResponse = {
        plan_type: "pro",
        rate_limit: {
          allowed: true,
          limit_reached: false,
          primary_window: {
            used_percent: 0,
            limit_window_seconds: 17940,
            reset_after_seconds: 17713,
            reset_at: 1761749128, // Unix timestamp: 2025-10-29T14:52:08Z
          },
          secondary_window: {
            used_percent: 4,
            limit_window_seconds: 604740,
            reset_after_seconds: 340972,
            reset_at: 1762072387, // Unix timestamp: 2025-11-02T08:53:07Z
          },
        },
        credits: null,
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockCodexResponse,
        async () => {
          return await chatGPTAdapter.fetchUsage({
            accessToken: "test-bearer-token",
          });
        },
      );

      // Verify the result is successful
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;

      // Verify service metadata
      expect(data.service).toBe("ChatGPT");
      expect(data.planType).toBe("pro");

      // Verify metadata conversion
      expect(data.metadata).toEqual({
        allowed: true,
        limitReached: false,
      });

      // Verify windows conversion
      expect(data.windows).toHaveLength(2);

      // Check Primary Window (~5 hours)
      const primaryWindow = data.windows[0];
      expect(primaryWindow).toEqual({
        name: "Primary Window (~5 hours)",
        utilization: 0,
        resetsAt: new Date(1761749128 * 1000), // Convert Unix timestamp to Date
        periodDurationMs: 17940 * 1000, // 17,940,000 ms (~4.98 hours)
      });

      // Check Secondary Window (~7 days)
      const secondaryWindow = data.windows[1];
      expect(secondaryWindow).toEqual({
        name: "Secondary Window (~7 days)",
        utilization: 4,
        resetsAt: new Date(1762072387 * 1000), // Convert Unix timestamp to Date
        periodDurationMs: 604740 * 1000, // 604,740,000 ms (~6.998 days)
      });
    });

    it("should handle different utilization values", async () => {
      const mockResponseHighUsage = {
        plan_type: "free",
        rate_limit: {
          allowed: false,
          limit_reached: true,
          primary_window: {
            used_percent: 100,
            limit_window_seconds: 18000, // Exactly 5 hours
            reset_after_seconds: 3600,
            reset_at: 1761750000,
          },
          secondary_window: {
            used_percent: 75,
            limit_window_seconds: 604800, // Exactly 7 days
            reset_after_seconds: 86400,
            reset_at: 1762080000,
          },
        },
        credits: 0,
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockResponseHighUsage,
        async () => {
          return await chatGPTAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;

      // Check metadata for rate limit reached
      expect(data.planType).toBe("free");
      expect(data.metadata).toEqual({
        allowed: false,
        limitReached: true,
      });

      // Verify high utilization values
      expect(data.windows[0]?.utilization).toBe(100);
      expect(data.windows[1]?.utilization).toBe(75);

      // Verify exact period durations
      expect(data.windows[0]?.periodDurationMs).toBe(18000000); // Exactly 5 hours
      expect(data.windows[1]?.periodDurationMs).toBe(604800000); // Exactly 7 days
    });

    it("should handle API errors gracefully", async () => {
      const errorResponse = {
        error: {
          message: "Unauthorized",
          code: "invalid_token",
        },
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        errorResponse,
        async () => {
          return await chatGPTAdapter.fetchUsage({
            accessToken: "invalid-token",
          });
        },
        403,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.message).toContain("API request failed: 403");
      expect(result.error.status).toBe(403);
    });

    it("should handle invalid response format", async () => {
      const invalidResponse = {
        unexpected: "format",
        no_rate_limit: true,
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        invalidResponse,
        async () => {
          return await chatGPTAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.message).toContain("Invalid response format");
    });
  });
});
