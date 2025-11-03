import { z } from "zod";

/**
 * Usage metric with utilization percentage and reset timestamp
 */
const UsageMetric = z.object({
  utilization: z.number(),
  resets_at: z.iso.datetime({ offset: true }),
});

/**
 * Complete usage response from the Anthropic API
 */
export const UsageResponse = z.object({
  five_hour: UsageMetric,
  seven_day: UsageMetric,
  seven_day_oauth_apps: UsageMetric.nullable().optional(),
  seven_day_opus: UsageMetric,
});

export type UsageResponse = z.infer<typeof UsageResponse>;
