import type { ServiceUsageData, UsageWindow } from "../types/domain.js";
import type {
  GeminiQuotaResponse,
  GeminiQuotaBucket,
} from "../types/gemini.js";

// Default period duration - Gemini quotas typically reset daily
const DEFAULT_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Model quota after grouping buckets by model
 */
type ModelQuota = {
  modelId: string;
  lowestRemainingFraction: number;
  resetTime: Date | undefined;
};

/**
 * Parse ISO8601 timestamp to Date
 */
export function parseResetTime(resetTimeString?: string): Date | undefined {
  if (!resetTimeString) {
    return undefined;
  }

  const date = new Date(resetTimeString);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Calculate period duration from reset time
 * Since Gemini quotas reset at the same time each day, assume 24-hour periods
 */
function calculatePeriodDuration(resetTime: Date | undefined): number {
  if (!resetTime) {
    return DEFAULT_PERIOD_MS;
  }

  // Gemini quotas reset daily, so period is 24 hours
  return DEFAULT_PERIOD_MS;
}

/**
 * Format model ID for display
 * "gemini-2.5-pro" -> "Gemini 2.5 Pro"
 */
export function formatModelName(modelId: string): string {
  return modelId
    .split("-")
    .map((part) => {
      // Capitalize first letter, keep version numbers as-is
      if (/^\d/u.test(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/**
 * Group quota buckets by model, keeping lowest remaining fraction per model
 * (input tokens are usually more restrictive than output)
 */
export function groupBucketsByModel(
  buckets: GeminiQuotaBucket[],
): ModelQuota[] {
  const modelMap = new Map<string, ModelQuota>();

  for (const bucket of buckets) {
    const existing = modelMap.get(bucket.modelId);

    if (
      !existing ||
      bucket.remainingFraction < existing.lowestRemainingFraction
    ) {
      modelMap.set(bucket.modelId, {
        modelId: bucket.modelId,
        lowestRemainingFraction: bucket.remainingFraction,
        resetTime: parseResetTime(bucket.resetTime),
      });
    }
  }

  return [...modelMap.values()];
}

/**
 * Convert model quota to usage window
 */
export function toUsageWindow(quota: ModelQuota): UsageWindow {
  // Convert remaining fraction (0-1) to utilization percentage (0-100)
  // remaining 0.6 means 40% utilized
  const utilization = (1 - quota.lowestRemainingFraction) * 100;

  return {
    name: formatModelName(quota.modelId),
    utilization: Math.round(utilization * 100) / 100, // Round to 2 decimal places
    resetsAt: quota.resetTime,
    periodDurationMs: calculatePeriodDuration(quota.resetTime),
  };
}

/**
 * Convert Gemini quota response to common domain model
 */
export function toServiceUsageData(
  response: GeminiQuotaResponse,
  planType?: string,
): ServiceUsageData {
  const modelQuotas = groupBucketsByModel(response.buckets);
  const windows = modelQuotas.map((quota) => toUsageWindow(quota));

  return {
    service: "Gemini",
    planType,
    windows,
  };
}
