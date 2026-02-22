import { z } from "zod";

/**
 * GitHub Copilot internal API response schema
 * Endpoint: GET https://api.github.com/copilot_internal/user
 */

const PremiumInteractionsSnapshot = z.object({
  entitlement: z.number(),
  remaining: z.number(),
  percent_remaining: z.number(),
  unlimited: z.boolean().optional(),
});

const QuotaSnapshots = z.object({
  premium_interactions: PremiumInteractionsSnapshot,
});

export const CopilotUsageResponse = z.object({
  quota_reset_date_utc: z.string(),
  copilot_plan: z.string(),
  quota_snapshots: QuotaSnapshots,
});

export type CopilotUsageResponse = z.infer<typeof CopilotUsageResponse>;
