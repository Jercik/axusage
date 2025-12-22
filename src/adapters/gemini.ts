import { getAgentAccessToken } from "axconfig";

import type {
  Result,
  ServiceAdapter,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import {
  fetchGeminiQuota,
  fetchGeminiProject,
} from "../services/gemini-api.js";
import { toServiceUsageData } from "./parse-gemini-usage.js";

/**
 * Gemini service adapter using direct API access.
 *
 * Uses the OAuth token from Gemini CLI's credential store (~/.gemini/oauth_creds.json)
 * to make direct API calls to Google's quota endpoint.
 */
export const geminiAdapter: ServiceAdapter = {
  name: "Gemini",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const accessToken = getAgentAccessToken("gemini");

    if (!accessToken) {
      return {
        ok: false,
        error: new ApiError(
          "No Gemini credentials found. Run 'gemini' to authenticate.",
        ),
      };
    }

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
  },
};
