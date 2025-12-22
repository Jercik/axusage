import { z } from "zod";

/**
 * Gemini CLI credential file schema (~/.gemini/oauth_creds.json)
 */
export const GeminiCredentials = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  id_token: z.string().optional(),
  expiry_date: z.number(), // milliseconds since epoch
});

export type GeminiCredentials = z.infer<typeof GeminiCredentials>;

/**
 * Gemini settings file schema (~/.gemini/settings.json)
 */
export const GeminiSettings = z.object({
  security: z
    .object({
      auth: z
        .object({
          selectedType: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type GeminiSettings = z.infer<typeof GeminiSettings>;

/**
 * Quota API bucket schema
 */
export const GeminiQuotaBucket = z.object({
  modelId: z.string(),
  remainingFraction: z.number(), // 0-1
  resetTime: z.string().optional(), // ISO8601
  tokenType: z.string().optional(), // "input" | "output"
});

export type GeminiQuotaBucket = z.infer<typeof GeminiQuotaBucket>;

/**
 * Quota API response schema
 */
export const GeminiQuotaResponse = z.object({
  buckets: z.array(GeminiQuotaBucket),
});

export type GeminiQuotaResponse = z.infer<typeof GeminiQuotaResponse>;

/**
 * Token refresh response schema
 */
export const GeminiTokenRefreshResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(), // seconds
  scope: z.string().optional(),
  token_type: z.string(),
  id_token: z.string().optional(),
});

export type GeminiTokenRefreshResponse = z.infer<
  typeof GeminiTokenRefreshResponse
>;

/**
 * Cloud Resource Manager projects response
 */
const GeminiProject = z.object({
  projectId: z.string(),
  projectNumber: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

export const GeminiProjectsResponse = z.object({
  projects: z.array(GeminiProject).optional(),
});

export type GeminiProjectsResponse = z.infer<typeof GeminiProjectsResponse>;
