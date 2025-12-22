import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type { GeminiCredentials } from "../types/gemini.js";
import {
  hasGeminiCredentials,
  readGeminiCredentials,
  readGeminiSettings,
  isTokenExpired,
  getSelectedAuthType,
  validateAuthType,
} from "../services/gemini-credentials.js";
import { refreshGeminiToken } from "../services/gemini-token-refresh.js";
import {
  fetchGeminiQuota,
  fetchGeminiProject,
} from "../services/gemini-api.js";
import { toServiceUsageData } from "./parse-gemini-usage.js";

/**
 * Refresh token if expired, otherwise return as-is
 */
async function ensureFreshCredentials(
  credentials: GeminiCredentials,
): Promise<GeminiCredentials> {
  if (!isTokenExpired(credentials)) {
    return credentials;
  }

  const refreshResult = await refreshGeminiToken(credentials);
  if (!refreshResult.ok) {
    throw new ApiError(
      `Token refresh failed: ${refreshResult.error.message}. Run 'agent-usage auth setup gemini' to re-authenticate.`,
    );
  }
  return refreshResult.value;
}

/**
 * Gemini service adapter
 *
 * Uses CLI-based authentication rather than browser auth.
 * Reads credentials from ~/.gemini/oauth_creds.json (created by Gemini CLI).
 */
export const geminiAdapter: ServiceAdapter = {
  name: "Gemini",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    try {
      // Check if credentials exist
      if (!hasGeminiCredentials()) {
        return {
          ok: false,
          error: new ApiError(
            "No saved authentication for gemini. Run 'agent-usage auth setup gemini' first.",
          ),
        };
      }

      // Read settings to check auth type
      const settingsResult = await readGeminiSettings();
      if (settingsResult.ok) {
        const authType = getSelectedAuthType(settingsResult.value);
        const authTypeValidation = validateAuthType(authType);
        if (!authTypeValidation.ok) {
          return authTypeValidation;
        }
      }

      // Read credentials and refresh if expired
      const credentialsResult = await readGeminiCredentials();
      if (!credentialsResult.ok) {
        return credentialsResult;
      }

      const credentials = await ensureFreshCredentials(credentialsResult.value);

      // Discover project ID for more accurate quotas (best effort)
      const projectId = await fetchGeminiProject(credentials.access_token);

      // Fetch quota data
      const quotaResult = await fetchGeminiQuota(
        credentials.access_token,
        projectId,
      );
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
                `Gemini fetch failed: ${error instanceof Error ? error.message : String(error)}`,
              ),
      };
    }
  },
};
