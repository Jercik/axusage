import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { GitHubCopilotUsageResponse as GitHubCopilotUsageResponseSchema } from "../types/github-copilot.js";
import { toServiceUsageData } from "./parse-github-copilot-usage.js";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";

// Copilot web fetches entitlements from this endpoint (requires GitHub session cookies)
const API_URL = "https://github.com/github-copilot/chat/entitlement";

/** Functional core is extracted to ./parse-github-copilot-usage.ts */

/**
 * GitHub Copilot service adapter
 */
export const githubCopilotAdapter: ServiceAdapter = {
  name: "GitHub Copilot",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const manager = new BrowserAuthManager();
    try {
      const body = await manager.makeAuthenticatedRequest(
        "github-copilot",
        API_URL,
      );
      const data = JSON.parse(body);
      const parseResult = GitHubCopilotUsageResponseSchema.safeParse(data);

      if (!parseResult.success) {
        return {
          ok: false,
          error: new ApiError(
            `Invalid response format: ${parseResult.error.message}`,
            undefined,
            data,
          ),
        };
      }

      try {
        return {
          ok: true,
          value: toServiceUsageData(parseResult.data),
        };
      } catch (error) {
        return {
          ok: false,
          error: new ApiError(
            error instanceof Error
              ? error.message
              : "Unable to parse GitHub Copilot reset date",
            undefined,
            parseResult.data.quotas.resetDate,
          ),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: new ApiError(
          `Browser authentication failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    } finally {
      await manager.close();
    }
  },
};
