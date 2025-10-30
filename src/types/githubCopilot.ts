import { z } from "zod";

/**
 * GitHub Copilot API response schemas
 */

export const GitHubCopilotQuotaLimits = z.object({
  premiumInteractions: z.number(),
});

export type GitHubCopilotQuotaLimits = z.infer<typeof GitHubCopilotQuotaLimits>;

export const GitHubCopilotQuotaRemaining = z.object({
  premiumInteractions: z.number(),
  chatPercentage: z.number().optional(),
  premiumInteractionsPercentage: z.number(),
});

export type GitHubCopilotQuotaRemaining = z.infer<
  typeof GitHubCopilotQuotaRemaining
>;

export const GitHubCopilotQuotas = z.object({
  limits: GitHubCopilotQuotaLimits,
  remaining: GitHubCopilotQuotaRemaining,
  resetDate: z.string(), // Format: "YYYY-MM-DD"
  overagesEnabled: z.boolean().optional(),
});

export type GitHubCopilotQuotas = z.infer<typeof GitHubCopilotQuotas>;

export const GitHubCopilotTrial = z.object({
  eligible: z.boolean(),
});

export type GitHubCopilotTrial = z.infer<typeof GitHubCopilotTrial>;

export const GitHubCopilotUsageResponse = z.object({
  licenseType: z.string(),
  quotas: GitHubCopilotQuotas,
  plan: z.string(),
  trial: GitHubCopilotTrial.optional(),
});

export type GitHubCopilotUsageResponse = z.infer<
  typeof GitHubCopilotUsageResponse
>;
