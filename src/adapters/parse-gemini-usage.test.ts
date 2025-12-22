import { describe, it, expect } from "vitest";
import {
  parseResetTime,
  formatModelName,
  groupBucketsByModel,
  toUsageWindow,
  toServiceUsageData,
} from "./parse-gemini-usage.js";
import type {
  GeminiQuotaBucket,
  GeminiQuotaResponse,
} from "../types/gemini.js";

describe("gemini parsing", () => {
  describe("parseResetTime", () => {
    it("parses valid ISO8601 timestamp", () => {
      const result = parseResetTime("2025-01-15T12:00:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-01-15T12:00:00.000Z");
    });

    it("returns undefined for undefined input", () => {
      expect(parseResetTime()).toBeUndefined();
    });

    it("returns undefined for invalid date string", () => {
      expect(parseResetTime("not-a-date")).toBeUndefined();
    });

    it("handles ISO8601 with milliseconds", () => {
      const result = parseResetTime("2025-01-15T12:00:00.123Z");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("formatModelName", () => {
    it("formats gemini model name correctly", () => {
      expect(formatModelName("gemini-2.5-pro")).toBe("Gemini 2.5 Pro");
    });

    it("preserves version numbers", () => {
      expect(formatModelName("gemini-2.5-flash")).toBe("Gemini 2.5 Flash");
    });

    it("handles single word model names", () => {
      expect(formatModelName("gemini")).toBe("Gemini");
    });

    it("handles complex model names", () => {
      expect(formatModelName("gemini-3-pro-preview")).toBe(
        "Gemini 3 Pro Preview",
      );
    });
  });

  describe("groupBucketsByModel", () => {
    it("groups buckets by model ID", () => {
      const buckets: GeminiQuotaBucket[] = [
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.8,
          tokenType: "input",
        },
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.9,
          tokenType: "output",
        },
        { modelId: "gemini-2.5-flash", remainingFraction: 0.7 },
      ];

      const result = groupBucketsByModel(buckets);
      expect(result).toHaveLength(2);
    });

    it("keeps lowest remaining fraction per model", () => {
      const buckets: GeminiQuotaBucket[] = [
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.8,
          tokenType: "input",
        },
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.5,
          tokenType: "output",
        },
      ];

      const result = groupBucketsByModel(buckets);
      expect(result).toHaveLength(1);
      expect(result[0]?.lowestRemainingFraction).toBe(0.5);
    });

    it("handles empty buckets array", () => {
      const result = groupBucketsByModel([]);
      expect(result).toHaveLength(0);
    });

    it("preserves reset time from lowest fraction bucket", () => {
      const buckets: GeminiQuotaBucket[] = [
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.9,
          resetTime: "2025-01-15T12:00:00Z",
        },
        {
          modelId: "gemini-2.5-pro",
          remainingFraction: 0.5,
          resetTime: "2025-01-16T12:00:00Z",
        },
      ];

      const result = groupBucketsByModel(buckets);
      expect(result[0]?.resetTime?.toISOString()).toBe(
        "2025-01-16T12:00:00.000Z",
      );
    });
  });

  describe("toUsageWindow", () => {
    it("converts remaining fraction to utilization percentage", () => {
      const quota = {
        modelId: "gemini-2.5-pro",
        lowestRemainingFraction: 0.6,
        resetTime: undefined,
      };

      const window = toUsageWindow(quota);
      expect(window.utilization).toBe(40); // 1 - 0.6 = 0.4 = 40%
    });

    it("formats model name correctly", () => {
      const quota = {
        modelId: "gemini-2.5-flash",
        lowestRemainingFraction: 0.8,
        resetTime: undefined,
      };

      const window = toUsageWindow(quota);
      expect(window.name).toBe("Gemini 2.5 Flash");
    });

    it("sets reset time correctly", () => {
      const resetDate = new Date("2025-01-15T12:00:00Z");
      const quota = {
        modelId: "gemini-2.5-pro",
        lowestRemainingFraction: 0.5,
        resetTime: resetDate,
      };

      const window = toUsageWindow(quota);
      expect(window.resetsAt).toEqual(resetDate);
    });

    it("uses default 24-hour period duration", () => {
      const quota = {
        modelId: "gemini-2.5-pro",
        lowestRemainingFraction: 0.5,
        resetTime: undefined,
      };

      const window = toUsageWindow(quota);
      expect(window.periodDurationMs).toBe(24 * 60 * 60 * 1000);
    });

    it("rounds utilization to 2 decimal places", () => {
      const quota = {
        modelId: "gemini-2.5-pro",
        lowestRemainingFraction: 1 / 3, // 0.333...
        resetTime: undefined,
      };

      const window = toUsageWindow(quota);
      expect(window.utilization).toBe(66.67);
    });
  });

  describe("toServiceUsageData", () => {
    it("converts quota response to service usage data", () => {
      const response: GeminiQuotaResponse = {
        buckets: [
          { modelId: "gemini-2.5-pro", remainingFraction: 0.6 },
          { modelId: "gemini-2.5-flash", remainingFraction: 0.8 },
        ],
      };

      const result = toServiceUsageData(response);
      expect(result.service).toBe("Gemini");
      expect(result.windows).toHaveLength(2);
    });

    it("includes plan type when provided", () => {
      const response: GeminiQuotaResponse = {
        buckets: [{ modelId: "gemini-2.5-pro", remainingFraction: 0.6 }],
      };

      const result = toServiceUsageData(response, "AI Pro");
      expect(result.planType).toBe("AI Pro");
    });

    it("handles empty buckets", () => {
      const response: GeminiQuotaResponse = { buckets: [] };
      const result = toServiceUsageData(response);
      expect(result.windows).toHaveLength(0);
    });

    it("groups multiple token types per model", () => {
      const response: GeminiQuotaResponse = {
        buckets: [
          {
            modelId: "gemini-2.5-pro",
            remainingFraction: 0.8,
            tokenType: "input",
          },
          {
            modelId: "gemini-2.5-pro",
            remainingFraction: 0.6,
            tokenType: "output",
          },
          { modelId: "gemini-2.5-flash", remainingFraction: 0.9 },
        ],
      };

      const result = toServiceUsageData(response);
      expect(result.windows).toHaveLength(2);

      const proWindow = result.windows.find((w) => w.name === "Gemini 2.5 Pro");
      expect(proWindow?.utilization).toBe(40); // Using lowest (0.6) -> 40% utilized
    });
  });
});
