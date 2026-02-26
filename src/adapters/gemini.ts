import type {
  Result,
  ServiceUsageFetcher,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import {
  fetchGeminiQuota,
  fetchGeminiProject,
} from "../services/gemini-api.js";
import { toServiceUsageData } from "./parse-gemini-usage.js";

/** Fetch Gemini usage data using a pre-resolved access token */
async function fetchGeminiUsageWithToken(
  accessToken: string,
): Promise<Result<ServiceUsageData, ApiError>> {
  try {
    // Discover project ID for more accurate quotas (best effort)
    const projectId = await fetchGeminiProject(accessToken);

    // Fetch quota data
    const quotaResult = await fetchGeminiQuota(accessToken, projectId);
    if (!quotaResult.ok) {
      return quotaResult;
    }

    return {
      ok: true,
      value: toServiceUsageData(quotaResult.value),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ApiError
          ? error
          : new ApiError(
              `Failed to fetch Gemini usage: ${error instanceof Error ? error.message : String(error)}`,
            ),
    };
  }
}

export const geminiUsageFetcher: ServiceUsageFetcher = {
  name: "Gemini",
  fetchUsageWithToken: fetchGeminiUsageWithToken,
};
