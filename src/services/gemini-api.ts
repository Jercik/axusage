import type { Result } from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type { GeminiQuotaResponse } from "../types/gemini.js";
import {
  GeminiQuotaResponse as GeminiQuotaResponseSchema,
  GeminiProjectsResponse as GeminiProjectsResponseSchema,
} from "../types/gemini.js";

// NOTE: This is an undocumented internal Google API used by Gemini CLI.
// It may change without notice. Last verified: December 2024.
const QUOTA_API_URL =
  "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota";
const PROJECTS_API_URL =
  "https://cloudresourcemanager.googleapis.com/v1/projects";

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Discover the Gemini project ID for more accurate quota retrieval
 */
export async function fetchGeminiProject(
  accessToken: string,
): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const response = await fetch(PROJECTS_API_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return undefined;
    }

    const data: unknown = await response.json();
    const parseResult = GeminiProjectsResponseSchema.safeParse(data);

    if (!parseResult.success || !parseResult.data.projects) {
      return undefined;
    }

    // Find Gemini CLI project (starts with gen-lang-client or has generative-language label)
    for (const project of parseResult.data.projects) {
      if (project.projectId.startsWith("gen-lang-client")) {
        return project.projectId;
      }
      if (project.labels?.["generative-language"] === "true") {
        return project.projectId;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch quota data from Gemini API
 */
export async function fetchGeminiQuota(
  accessToken: string,
  projectId?: string,
): Promise<Result<GeminiQuotaResponse, ApiError>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const body = projectId ? JSON.stringify({ project: projectId }) : "{}";

    const response = await fetch(QUOTA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return {
        ok: false,
        error: new ApiError(
          "Gemini authentication expired. Run 'gemini' to re-authenticate.",
          401,
        ),
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: new ApiError(
          `Gemini API error: ${String(response.status)} ${errorText}`,
          response.status,
        ),
      };
    }

    const data: unknown = await response.json();
    const parseResult = GeminiQuotaResponseSchema.safeParse(data);

    if (!parseResult.success) {
      return {
        ok: false,
        error: new ApiError(
          `Invalid Gemini quota response: ${parseResult.error.message}`,
          undefined,
          data,
        ),
      };
    }

    if (parseResult.data.buckets.length === 0) {
      return {
        ok: false,
        error: new ApiError(
          "No quota data available. Token may be invalid or expired.",
        ),
      };
    }

    return { ok: true, value: parseResult.data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: new ApiError("Gemini quota API request timed out."),
      };
    }

    return {
      ok: false,
      error: new ApiError(
        `Failed to fetch Gemini quota: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}
