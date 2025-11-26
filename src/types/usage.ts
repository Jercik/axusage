import { z } from "zod";

/**
 * Usage metric with utilization percentage and reset timestamp
 */
const UsageMetric = z.object({
  utilization: z.number(),
  // Transform API null to undefined so the rest of the app only handles string | undefined.
  resets_at: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((value): string | undefined =>
      value === null ? undefined : value,
    ),
});

/**
 * Complete usage response from the Anthropic API
 *
 * Note: `seven_day_opus` and `seven_day_sonnet` can be null depending on the
 * user's plan. The API may return either, both, or neither.
 */
export const UsageResponse = z.object({
  five_hour: UsageMetric,
  seven_day: UsageMetric,
  seven_day_oauth_apps: UsageMetric.nullable().optional(),
  seven_day_opus: UsageMetric.nullable().optional(),
  seven_day_sonnet: UsageMetric.nullable().optional(),
});

export type UsageResponse = z.infer<typeof UsageResponse>;
export type UsageResponseInput = z.input<typeof UsageResponse>;
