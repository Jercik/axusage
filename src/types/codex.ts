import { z } from "zod";

/**
 * ChatGPT API response schemas
 */

export const CodexRateLimitWindow = z.object({
  used_percent: z.number(),
  limit_window_seconds: z.number(),
  reset_after_seconds: z.number(),
  reset_at: z.number(), // Unix timestamp
});

export type CodexRateLimitWindow = z.infer<typeof CodexRateLimitWindow>;

const CodexRateLimit = z.object({
  allowed: z.boolean(),
  limit_reached: z.boolean(),
  primary_window: CodexRateLimitWindow,
  secondary_window: CodexRateLimitWindow,
});

const CodexAdditionalRateLimit = z.object({
  limit_name: z.string(),
  metered_feature: z.string(),
  rate_limit: z
    .object({
      allowed: z.boolean(),
      limit_reached: z.boolean(),
      primary_window: CodexRateLimitWindow.optional(),
      secondary_window: CodexRateLimitWindow.optional(),
    })
    .nullable()
    .optional(),
});

export type CodexAdditionalRateLimit = z.infer<typeof CodexAdditionalRateLimit>;

export const CodexUsageResponse = z.object({
  plan_type: z.string(),
  rate_limit: CodexRateLimit,
  credits: z.unknown().nullable(),
  additional_rate_limits: z
    .array(CodexAdditionalRateLimit)
    .nullable()
    .optional(),
});

export type CodexUsageResponse = z.infer<typeof CodexUsageResponse>;
