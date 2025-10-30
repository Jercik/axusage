import { z } from "zod";

/**
 * Usage metric with utilization percentage and reset timestamp
 */
export const UsageMetric = z.object({
  utilization: z.number(),
  resets_at: z.iso.datetime({ offset: true }),
});

export type UsageMetric = z.infer<typeof UsageMetric>;

/**
 * Complete usage response from the Anthropic API
 */
export const UsageResponse = z.object({
  five_hour: UsageMetric,
  seven_day: UsageMetric,
  seven_day_oauth_apps: UsageMetric.nullable(),
  seven_day_opus: UsageMetric,
});

export type UsageResponse = z.infer<typeof UsageResponse>;

/**
 * Valid usage types that can be queried
 */
export type UsageType =
  | "five_hour"
  | "seven_day"
  | "seven_day_oauth_apps"
  | "seven_day_opus";
