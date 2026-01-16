import { describe, it, expect } from "vitest";
import {
  parseResetDate,
  calculatePeriodDuration,
  toServiceUsageData,
} from "./parse-github-copilot-usage.js";
import type { GitHubCopilotUsageResponse } from "../types/github-copilot.js";

describe("github-copilot parsing", () => {
  describe("parseResetDate", () => {
    it("parses valid YYYY-MM-DD as UTC midnight", () => {
      const d = parseResetDate("2025-11-01");
      expect(d.toISOString()).toBe("2025-11-01T00:00:00.000Z");
    });

    it("throws on invalid format", () => {
      expect(() => parseResetDate("2025/11/01")).toThrowError();
      expect(() => parseResetDate("2025-13-01")).toThrowError();
      expect(() => parseResetDate("2025-00-10")).toThrowError();
      expect(() => parseResetDate("2025-11-32")).toThrowError();
      expect(() => parseResetDate("2025-11")).toThrowError();
    });
  });

  describe("calculatePeriodDuration", () => {
    it("computes previous month same day duration (handles varying month lengths)", () => {
      const resetDate = new Date("2025-03-31T00:00:00Z");
      const ms = calculatePeriodDuration(resetDate);
      // Feb 2025 has 28 days; duration should be Mar31 - Feb28 (UTC midnight)
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
    it("maps response and rounds utilization to 2 decimals", () => {
      const resp: GitHubCopilotUsageResponse = {
        licenseType: "licensed_full",
        quotas: {
          limits: { premiumInteractions: 1500 },
          remaining: {
            premiumInteractions: 1392,
            premiumInteractionsPercentage: 0,
          },
          resetDate: "2025-11-01",
          overagesEnabled: false,
        },
        plan: "pro_plus",
        trial: { eligible: false },
      };

      const data = toServiceUsageData(resp);
      expect(data.service).toBe("GitHub Copilot");
      expect(data.planType).toBe("pro_plus");
      expect(data.windows).toHaveLength(1);
      const w = data.windows[0];
      expect(w).toBeDefined();
      // Type assertion: we've verified w is defined above
      const window = w as NonNullable<typeof w>;
      expect(window.name).toBe("Monthly Premium Interactions");
      // (1500 - 1392)/1500*100 = 7.2
      expect(window.utilization).toBeCloseTo(7.2, 5);
      expect(window.resetsAt).toBeDefined();
      expect(window.resetsAt?.toISOString()).toBe("2025-11-01T00:00:00.000Z");
      expect(window.periodDurationMs).toBeGreaterThan(0);
    });
  });
});
