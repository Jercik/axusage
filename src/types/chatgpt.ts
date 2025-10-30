import { z } from "zod";

/**
 * ChatGPT API response schemas
 */

export const ChatGPTRateLimitWindow = z.object({
  used_percent: z.number(),
  limit_window_seconds: z.number(),
  reset_after_seconds: z.number(),
  reset_at: z.number(), // Unix timestamp
});

export type ChatGPTRateLimitWindow = z.infer<typeof ChatGPTRateLimitWindow>;

const ChatGPTRateLimit = z.object({
  allowed: z.boolean(),
  limit_reached: z.boolean(),
  primary_window: ChatGPTRateLimitWindow,
  secondary_window: ChatGPTRateLimitWindow,
});

export const ChatGPTUsageResponse = z.object({
  plan_type: z.string(),
  rate_limit: ChatGPTRateLimit,
  credits: z.any().nullable(),
});

export type ChatGPTUsageResponse = z.infer<typeof ChatGPTUsageResponse>;
