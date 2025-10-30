import { describe, it, expect } from "vitest";
import { githubCopilotAdapter } from "./githubCopilot.js";
import { withMockFetch } from "../test-utils/mock-fetch.js";
import type { Result, ServiceUsageData } from "../types/domain.js";
import { ApiError } from "../types/domain.js";

describe("GitHub Copilot Adapter", () => {
  describe("fetchUsage", () => {
    it("should convert GitHub Copilot API response to common format", async () => {
      // Actual response from example HAR file
      const mockCopilotResponse = {
        licenseType: "licensed_full",
        quotas: {
          limits: {
            premiumInteractions: 1500,
          },
          remaining: {
            premiumInteractions: 1392,
            chatPercentage: 100.0,
            premiumInteractionsPercentage: 92.83266666666667,
          },
          resetDate: "2025-11-01",
          overagesEnabled: false,
        },
        plan: "pro_plus",
        trial: {
          eligible: false,
        },
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockCopilotResponse,
        async () => {
          return await githubCopilotAdapter.fetchUsage({
            accessToken: "test-session-token",
          });
        },
      );

      // Verify the result is successful
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;

      // Verify service metadata
      expect(data.service).toBe("GitHub Copilot");
      expect(data.planType).toBe("pro_plus");

      // Verify windows conversion
      expect(data.windows).toHaveLength(1);

      const window = data.windows[0];
      expect(window).toBeDefined();
      expect(window?.name).toBe("Monthly Premium Interactions");

      // Calculate expected utilization: (1500 - 1392) / 1500 * 100 = 7.2%
      expect(window?.utilization).toBeCloseTo(7.2, 1);

      // Verify reset date parsing
      expect(window?.resetsAt).toEqual(new Date("2025-11-01T00:00:00.000Z"));
    });

    it("should handle different utilization values", async () => {
      const mockResponseHighUsage = {
        licenseType: "licensed_full",
        quotas: {
          limits: {
            premiumInteractions: 2000,
          },
          remaining: {
            premiumInteractions: 100,
            premiumInteractionsPercentage: 5.0,
          },
          resetDate: "2025-12-01",
        },
        plan: "enterprise",
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockResponseHighUsage,
        async () => {
          return await githubCopilotAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;

      expect(data.planType).toBe("enterprise");

      // Verify high utilization calculation: (2000 - 100) / 2000 * 100 = 95%
      const window = data.windows[0];
      expect(window?.utilization).toBeCloseTo(95, 1);
    });

    it("should handle authentication errors gracefully", async () => {
      const errorResponse = {
        message: "Requires authentication",
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        errorResponse,
        async () => {
          return await githubCopilotAdapter.fetchUsage({
            accessToken: "invalid-session",
          });
        },
        401,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.message).toContain("Authentication failed");
      expect(result.error.status).toBe(401);
    });

    it("should handle invalid response format", async () => {
      const invalidResponse = {
        unexpected: "format",
        no_quotas: true,
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        invalidResponse,
        async () => {
          return await githubCopilotAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error.message).toContain("Invalid response format");
    });

    it("should handle zero remaining interactions", async () => {
      const mockResponseNoRemaining = {
        licenseType: "licensed_full",
        quotas: {
          limits: {
            premiumInteractions: 1000,
          },
          remaining: {
            premiumInteractions: 0,
            premiumInteractionsPercentage: 0,
          },
          resetDate: "2025-11-15",
        },
        plan: "pro",
      };

      const result: Result<ServiceUsageData, ApiError> = await withMockFetch(
        mockResponseNoRemaining,
        async () => {
          return await githubCopilotAdapter.fetchUsage({
            accessToken: "test-token",
          });
        },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const data = result.value;
      const window = data.windows[0];

      // 100% utilized when no interactions remain
      expect(window?.utilization).toBe(100);
    });
  });
});
