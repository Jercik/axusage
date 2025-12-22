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
 * Quota pool containing models that share the same quota
 */
type QuotaPool = {
  modelIds: string[];
  remainingFraction: number;
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

// Gemini quotas reset daily, so period is always 24 hours
const PERIOD_DURATION_MS = DEFAULT_PERIOD_MS;

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
 * Format multiple model names for display
 * Single model: "Gemini 2.5 Pro"
 * Multiple models: "Gemini 2.0 Flash, 2.5 Flash, 2.5 Flash Lite"
 */
export function formatPoolName(modelIds: string[]): string {
  if (modelIds.length === 0) {
    return "";
  }

  if (modelIds.length === 1) {
    // Length check guarantees element exists, but noUncheckedIndexedAccess requires assertion
    return formatModelName(modelIds[0] as string);
  }

  // For multiple models, use shortened format: "Gemini 2.0 Flash, 2.5 Flash, 2.5 Flash Lite"
  const formattedNames = modelIds.map((id) => formatModelName(id));

  // Extract common prefix (e.g., "Gemini") if all names share it
  const firstWords = formattedNames.map((name) => name.split(" ")[0] ?? "");
  const firstPrefix = firstWords[0] ?? "";
  const allSamePrefix =
    firstPrefix !== "" && firstWords.every((word) => word === firstPrefix);

  if (allSamePrefix) {
    const suffixes = formattedNames.map((name) =>
      name.slice(firstPrefix.length + 1),
    );

    // Fallback if any suffix is empty (e.g. ["Gemini", "Gemini Pro"] -> would be "Gemini , Pro")
    if (suffixes.some((s) => !s)) {
      return formattedNames.join(", ");
    }

    return `${firstPrefix} ${suffixes.join(", ")}`;
  }

  return formattedNames.join(", ");
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
 * Create a unique key for a quota pool based on remaining fraction and reset time
 */
function createPoolKey(
  remainingFraction: number,
  resetTime: Date | undefined,
): string {
  const resetTimeKey = resetTime?.toISOString() ?? "none";
  return `${remainingFraction.toFixed(6)}|${resetTimeKey}`;
}

/**
 * Group models that share the same quota (same remainingFraction and resetTime)
 */
export function groupByQuotaPool(modelQuotas: ModelQuota[]): QuotaPool[] {
  const poolMap = new Map<string, QuotaPool>();

  for (const quota of modelQuotas) {
    const key = createPoolKey(quota.lowestRemainingFraction, quota.resetTime);
    const existing = poolMap.get(key);

    if (existing) {
      existing.modelIds.push(quota.modelId);
    } else {
      poolMap.set(key, {
        modelIds: [quota.modelId],
        remainingFraction: quota.lowestRemainingFraction,
        resetTime: quota.resetTime,
      });
    }
  }

  // Sort model IDs within each pool for consistent ordering
  for (const pool of poolMap.values()) {
    pool.modelIds.sort();
  }

  return [...poolMap.values()];
}

/**
 * Convert quota pool to usage window
 */
export function poolToUsageWindow(pool: QuotaPool): UsageWindow {
  // Convert remaining fraction (0-1) to utilization percentage (0-100)
  // remaining 0.6 means 40% utilized
  const utilization = (1 - pool.remainingFraction) * 100;

  return {
    name: formatPoolName(pool.modelIds),
    utilization: Math.round(utilization * 100) / 100, // Round to 2 decimal places
    resetsAt: pool.resetTime,
    periodDurationMs: PERIOD_DURATION_MS,
  };
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
    periodDurationMs: PERIOD_DURATION_MS,
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
  const quotaPools = groupByQuotaPool(modelQuotas);
  const windows = quotaPools.map((pool) => poolToUsageWindow(pool));

  return {
    service: "Gemini",
    planType,
    windows,
  };
}
