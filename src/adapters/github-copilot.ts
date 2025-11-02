import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { GitHubCopilotUsageResponse as GitHubCopilotUsageResponseSchema } from "../types/github-copilot.js";
import { toServiceUsageData } from "./parse-github-copilot-usage.js";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";

const API_URL = "https://github.com/github-copilot/chat/entitlement";

/** Functional core is extracted to ./parse-github-copilot-usage.ts */

/**
 * Fetch usage data using token-based authentication (session cookie)
 */
async function fetchWithToken(
  accessToken: string,
): Promise<Result<ServiceUsageData, ApiError>> {
  try {
    // The access token for Copilot is actually a session cookie value
    // Decode if URL-encoded (e.g., %2F -> /)
    const sessionToken = decodeURIComponent(accessToken);

    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-requested-with": "XMLHttpRequest",
        "github-verified-fetch": "true",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        cookie: `user_session=${sessionToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "Unable to read response");

      // Special handling for common GitHub errors
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          error: new ApiError(
            `Authentication failed. Please ensure your GitHub session token is valid.`,
            response.status,
            body,
          ),
        };
      }

      return {
        ok: false,
        error: new ApiError(
          `API request failed: ${String(response.status)} ${response.statusText}`,
          response.status,
          body,
        ),
      };
    }

    const data = await response.json();
    const parseResult = GitHubCopilotUsageResponseSchema.safeParse(data);

    if (!parseResult.success) {
      return {
        ok: false,
        error: new ApiError(
          `Invalid response format: ${parseResult.error.message}`,
          response.status,
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
          response.status,
          parseResult.data.quotas.resetDate,
        ),
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: new ApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

/**
 * Fetch usage data using browser-based authentication
 */
async function fetchWithBrowser(): Promise<Result<ServiceUsageData, ApiError>> {
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
}

/**
 * GitHub Copilot service adapter
 *
 * Note: This adapter supports both session cookie and browser-based authentication
 */
export const githubCopilotAdapter: ServiceAdapter = {
  name: "GitHub Copilot",

  async fetchUsage(
    config: ServiceConfig,
  ): Promise<Result<ServiceUsageData, ApiError>> {
    // Use browser-based auth if explicitly requested or if no token is provided
    if (config.useBrowserAuth || !config.accessToken) {
      return fetchWithBrowser();
    }

    return fetchWithToken(config.accessToken);
  },
};
