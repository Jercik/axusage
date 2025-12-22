import { z } from "zod";

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
