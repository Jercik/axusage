import { describe, it, expect } from "vitest";
import {
  parseResetTime,
  formatModelName,
  formatPoolName,
  groupBucketsByModel,
  groupByQuotaPool,
  poolToUsageWindow,
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

  describe("formatPoolName", () => {
    it("returns empty string for empty array", () => {
      expect(formatPoolName([])).toBe("");
    });

    it("returns single model name for single model", () => {
      expect(formatPoolName(["gemini-2.5-pro"])).toBe("Gemini 2.5 Pro");
    });

    it("combines models with common prefix", () => {
      expect(
        formatPoolName([
          "gemini-2.0-flash",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
        ]),
      ).toBe("Gemini 2.0 Flash, 2.5 Flash, 2.5 Flash Lite");
    });

    it("combines Pro models with common prefix", () => {
      expect(formatPoolName(["gemini-2.5-pro", "gemini-3-pro-preview"])).toBe(
        "Gemini 2.5 Pro, 3 Pro Preview",
      );
    });

    it("handles models without common prefix", () => {
      // Unlikely case but should still work
      expect(formatPoolName(["alpha-model", "beta-model"])).toBe(
        "Alpha Model, Beta Model",
      );
    });

    it("falls back when model name equals prefix", () => {
      // Edge case: "Gemini" has no suffix after the prefix
      expect(formatPoolName(["gemini", "gemini-pro"])).toBe(
        "Gemini, Gemini Pro",
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

  describe("groupByQuotaPool", () => {
    it("groups models with same remaining fraction and reset time", () => {
      const resetTime = new Date("2025-01-15T12:00:00Z");
      const modelQuotas = [
        {
          modelId: "gemini-2.0-flash",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
        {
          modelId: "gemini-2.5-flash-lite",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result).toHaveLength(1);
      expect(result[0]?.modelIds).toHaveLength(3);
      expect(result[0]?.modelIds).toEqual([
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ]);
    });

    it("separates models with different remaining fractions", () => {
      const resetTime = new Date("2025-01-15T12:00:00Z");
      const modelQuotas = [
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
        { modelId: "gemini-2.5-pro", lowestRemainingFraction: 0.6, resetTime },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result).toHaveLength(2);
    });

    it("separates models with different reset times", () => {
      const modelQuotas = [
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.8,
          resetTime: new Date("2025-01-15T12:00:00Z"),
        },
        {
          modelId: "gemini-2.5-pro",
          lowestRemainingFraction: 0.8,
          resetTime: new Date("2025-01-16T12:00:00Z"),
        },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result).toHaveLength(2);
    });

    it("sorts model IDs within each pool", () => {
      const resetTime = new Date("2025-01-15T12:00:00Z");
      const modelQuotas = [
        {
          modelId: "gemini-2.5-flash-lite",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
        {
          modelId: "gemini-2.0-flash",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.8,
          resetTime,
        },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result[0]?.modelIds).toEqual([
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ]);
    });

    it("handles undefined reset times", () => {
      const modelQuotas = [
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.8,
          resetTime: undefined,
        },
        {
          modelId: "gemini-2.5-pro",
          lowestRemainingFraction: 0.8,
          resetTime: undefined,
        },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result).toHaveLength(1);
      expect(result[0]?.modelIds).toHaveLength(2);
    });

    it("groups models with floating-point precision variations", () => {
      // toFixed(6) handles floating-point variations by rounding
      // 0.8000001 and 0.8000002 both become "0.800000"
      const resetTime = new Date("2025-01-15T12:00:00Z");
      const modelQuotas = [
        {
          modelId: "gemini-2.5-flash",
          lowestRemainingFraction: 0.800_000_1,
          resetTime,
        },
        {
          modelId: "gemini-2.5-pro",
          lowestRemainingFraction: 0.800_000_2,
          resetTime,
        },
      ];

      const result = groupByQuotaPool(modelQuotas);
      expect(result).toHaveLength(1);
      expect(result[0]?.modelIds).toEqual([
        "gemini-2.5-flash",
        "gemini-2.5-pro",
      ]);
    });
  });

  describe("poolToUsageWindow", () => {
    it("converts pool to usage window with combined name", () => {
      const pool = {
        modelIds: ["gemini-2.0-flash", "gemini-2.5-flash"],
        remainingFraction: 0.6,
        resetTime: new Date("2025-01-15T12:00:00Z"),
      };

      const window = poolToUsageWindow(pool);
      expect(window.name).toBe("Gemini 2.0 Flash, 2.5 Flash");
      expect(window.utilization).toBe(40); // 1 - 0.6 = 0.4 = 40%
    });

    it("uses single model name for single-model pool", () => {
      const pool = {
        modelIds: ["gemini-2.5-pro"],
        remainingFraction: 0.7,
        resetTime: undefined,
      };

      const window = poolToUsageWindow(pool);
      expect(window.name).toBe("Gemini 2.5 Pro");
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
      // Each model has different remaining fraction, so 2 pools
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
      // Pro uses lowest (0.6), Flash uses 0.9 - different fractions = 2 pools
      expect(result.windows).toHaveLength(2);

      const proWindow = result.windows.find((w) => w.name === "Gemini 2.5 Pro");
      expect(proWindow?.utilization).toBe(40); // Using lowest (0.6) -> 40% utilized
    });

    it("groups models that share the same quota pool", () => {
      const response: GeminiQuotaResponse = {
        buckets: [
          {
            modelId: "gemini-2.0-flash",
            remainingFraction: 0.8,
            resetTime: "2025-01-15T12:00:00Z",
          },
          {
            modelId: "gemini-2.5-flash",
            remainingFraction: 0.8,
            resetTime: "2025-01-15T12:00:00Z",
          },
          {
            modelId: "gemini-2.5-flash-lite",
            remainingFraction: 0.8,
            resetTime: "2025-01-15T12:00:00Z",
          },
          {
            modelId: "gemini-2.5-pro",
            remainingFraction: 0.6,
            resetTime: "2025-01-15T10:00:00Z",
          },
          {
            modelId: "gemini-3-pro-preview",
            remainingFraction: 0.6,
            resetTime: "2025-01-15T10:00:00Z",
          },
        ],
      };

      const result = toServiceUsageData(response);
      // Flash models share quota, Pro models share quota = 2 pools
      expect(result.windows).toHaveLength(2);

      const flashPool = result.windows.find((w) =>
        w.name.includes("2.0 Flash"),
      );
      expect(flashPool?.name).toBe(
        "Gemini 2.0 Flash, 2.5 Flash, 2.5 Flash Lite",
      );
      expect(flashPool?.utilization).toBe(20); // 1 - 0.8 = 0.2 = 20%

      const proPool = result.windows.find((w) => w.name.includes("2.5 Pro"));
      expect(proPool?.name).toBe("Gemini 2.5 Pro, 3 Pro Preview");
      expect(proPool?.utilization).toBe(40); // 1 - 0.6 = 0.4 = 40%
    });
  });
});
