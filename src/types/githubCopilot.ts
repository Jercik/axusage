import { z } from "zod";

/**
 * GitHub Copilot API response schemas
 */

const GitHubCopilotQuotaLimits = z.object({
  premiumInteractions: z.number(),
});

const GitHubCopilotQuotaRemaining = z.object({
  premiumInteractions: z.number(),
  chatPercentage: z.number().optional(),
  premiumInteractionsPercentage: z.number(),
});

const GitHubCopilotQuotas = z.object({
  limits: GitHubCopilotQuotaLimits,
  remaining: GitHubCopilotQuotaRemaining,
  resetDate: z.string(), // Format: "YYYY-MM-DD"
  overagesEnabled: z.boolean().optional(),
});

const GitHubCopilotTrial = z.object({
  eligible: z.boolean(),
});

export const GitHubCopilotUsageResponse = z.object({
  licenseType: z.string(),
  quotas: GitHubCopilotQuotas,
  plan: z.string(),
  trial: GitHubCopilotTrial.optional(),
});

export type GitHubCopilotUsageResponse = z.infer<
  typeof GitHubCopilotUsageResponse
>;
