import { describe, it, expect } from "vitest";
import { claudeAdapter } from "./claude.js";
import { withMockFetch } from "../test-utils/mock-fetch.js";
import type { Result, ServiceUsageData, ApiError } from "#types/domain";

describe("Claude Adapter", () => {
  describe("fetchUsage", () => {
    it("should convert Anthropic API response to common format", async () => {
      // Actual response from example-requests/claude-usage/[49] Response
      const mockAnthropicResponse = {
        five_hour: {
          utilization: 3,
          resets_at: "2025-10-29T14:00:00.123749+00:00",
        },
        seven_day: {
          utilization: 17,
          resets_at: "2025-10-30T09:00:00.123769+00:00",
        },
        seven_day_oauth_apps: null,
        seven_day_opus: {
          utilization: 29,
          resets_at: "2025-11-01T17:00:00.123777+00:00",
        },
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockAnthropicResponse,
        async () => {
          return await claudeAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      // Verify the result is successful
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;

      // Verify service metadata
      expect(data.service).toBe("Claude");
      expect(data.planType).toBeUndefined();
      expect(data.metadata).toBeUndefined();

      // Verify windows conversion
      expect(data.windows).toHaveLength(3); // OAuth apps is null, so should be excluded

      // Check 5-Hour Usage window
      const fiveHourWindow = data.windows[0];
      expect(fiveHourWindow).toEqual({
        name: "5-Hour Usage",
        utilization: 3,
        resetsAt: new Date("2025-10-29T14:00:00.123749+00:00"),
        periodDurationMs: 5 * 60 * 60 * 1000, // 18,000,000 ms
      });

      // Check 7-Day Usage window
      const sevenDayWindow = data.windows[1];
      expect(sevenDayWindow).toEqual({
        name: "7-Day Usage",
        utilization: 17,
        resetsAt: new Date("2025-10-30T09:00:00.123769+00:00"),
        periodDurationMs: 7 * 24 * 60 * 60 * 1000, // 604,800,000 ms
      });

      // Check 7-Day Opus Usage window
      const sevenDayOpusWindow = data.windows[2];
      expect(sevenDayOpusWindow).toEqual({
        name: "7-Day Opus Usage",
        utilization: 29,
        resetsAt: new Date("2025-11-01T17:00:00.123777+00:00"),
        periodDurationMs: 7 * 24 * 60 * 60 * 1000, // 604,800,000 ms
      });
    });

    it("should include seven_day_oauth_apps when present", async () => {
      const mockResponseWithOAuth = {
        five_hour: {
          utilization: 5,
          resets_at: "2025-10-29T14:00:00+00:00",
        },
        seven_day: {
          utilization: 15,
          resets_at: "2025-10-30T09:00:00+00:00",
        },
        seven_day_oauth_apps: {
          utilization: 20,
          resets_at: "2025-10-31T10:00:00+00:00",
        },
        seven_day_opus: {
          utilization: 25,
          resets_at: "2025-11-01T17:00:00+00:00",
        },
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockResponseWithOAuth,
        async () => {
          return await claudeAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;
      expect(data.windows).toHaveLength(4);

      // Verify OAuth Apps window is included
      const oauthWindow = data.windows[2];
      expect(oauthWindow).toEqual({
        name: "7-Day OAuth Apps",
        utilization: 20,
        resetsAt: new Date("2025-10-31T10:00:00+00:00"),
        periodDurationMs: 7 * 24 * 60 * 60 * 1000,
      });
    });

    it("should handle API errors gracefully", async () => {
      const errorResponse = {
        error: "Invalid token",
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        errorResponse,
        async () => {
          return await claudeAdapter.fetchUsage({
            accessToken: "invalid-token",
          });
        },
        401,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.message).toContain("API request failed: 401");
      expect(result.error.status).toBe(401);
    });

    it("should handle invalid response format", async () => {
      const invalidResponse = {
        unexpected: "format",
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        invalidResponse,
        async () => {
          return await claudeAdapter.fetchUsage({
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
