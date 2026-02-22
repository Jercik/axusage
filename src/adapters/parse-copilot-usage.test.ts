import { describe, it, expect, assert } from "vitest";
import {
  calculatePeriodDuration,
  toServiceUsageData,
} from "./parse-copilot-usage.js";
import type { CopilotUsageResponse } from "../types/copilot.js";

describe("copilot parsing", () => {
  describe("calculatePeriodDuration", () => {
    it("computes previous month same day duration (handles varying month lengths)", () => {
      const resetDate = new Date("2025-03-31T00:00:00Z");
      const ms = calculatePeriodDuration(resetDate);
      const expected =
        resetDate.getTime() - new Date("2025-02-28T00:00:00Z").getTime();
      expect(ms).toBe(expected);
    });

    it("floors at 0 for negative durations", () => {
      const resetDate = new Date(0);
      const ms = calculatePeriodDuration(resetDate);
      expect(ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe("toServiceUsageData", () => {
    it("calculates utilization from entitlement and remaining", () => {
      const resp: CopilotUsageResponse = {
        quota_reset_date_utc: "2026-03-01T00:00:00.000Z",
        copilot_plan: "individual_pro",
        quota_snapshots: {
          premium_interactions: {
            entitlement: 1500,
            remaining: 505,
            percent_remaining: 33.67,
          },
        },
      };

      const data = toServiceUsageData(resp);
      expect(data.service).toBe("GitHub Copilot");
      expect(data.planType).toBe("individual_pro");
      expect(data.windows).toHaveLength(1);
      const window = data.windows[0];
      assert(window);
      expect(window.name).toBe("Monthly Premium Interactions");
      // (1500 - 505) / 1500 * 100 = 66.333...  rounded to 66.33
      expect(window.utilization).toBeCloseTo(66.33, 1);
      expect(window.resetsAt).toBeDefined();
      expect(window.resetsAt?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
      expect(window.periodDurationMs).toBeGreaterThan(0);
    });

    it("handles unlimited plan", () => {
      const resp: CopilotUsageResponse = {
        quota_reset_date_utc: "2026-03-01T00:00:00.000Z",
        copilot_plan: "enterprise",
        quota_snapshots: {
          premium_interactions: {
            entitlement: 0,
            remaining: 0,
            percent_remaining: 0,
            unlimited: true,
          },
        },
      };

      const data = toServiceUsageData(resp);
      expect(data.service).toBe("GitHub Copilot");
      expect(data.planType).toBe("enterprise");
      expect(data.windows).toHaveLength(1);
      const window = data.windows[0];
      assert(window);
      expect(window.utilization).toBe(0);
      expect(window.resetsAt).toBeUndefined();
      expect(window.periodDurationMs).toBe(0);
    });

    it("parses reset date from quota_reset_date_utc", () => {
      const resp: CopilotUsageResponse = {
        quota_reset_date_utc: "2026-04-15T00:00:00.000Z",
        copilot_plan: "individual_pro",
        quota_snapshots: {
          premium_interactions: {
            entitlement: 1500,
            remaining: 1500,
            percent_remaining: 100,
          },
        },
      };

      const data = toServiceUsageData(resp);
      const window = data.windows[0];
      assert(window);
      expect(window.resetsAt?.toISOString()).toBe("2026-04-15T00:00:00.000Z");
    });
  });
});
