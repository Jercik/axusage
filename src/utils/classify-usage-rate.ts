type UsageRateCategory = "green" | "yellow" | "red";

/**
 * Classifies a usage rate into a severity bucket
 */
export function classifyUsageRate(rate: number): UsageRateCategory {
  if (rate > 1.5) return "red";
  if (rate > 1) return "yellow";
  return "green";
}
