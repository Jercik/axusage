import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { ChatGPTUsageResponse as ChatGPTUsageResponseSchema } from "../types/chatgpt.js";
import { toServiceUsageData } from "./parse-chatgpt-usage.js";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

/** Functional core is extracted to ./parse-chatgpt-usage.ts */

/**
 * Fetch usage data using token-based authentication
 */
async function fetchWithToken(
  accessToken: string,
): Promise<Result<ServiceUsageData, ApiError>> {
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "*/*",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "Unable to read response");
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
    const parseResult = ChatGPTUsageResponseSchema.safeParse(data);

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

    return {
      ok: true,
      value: toServiceUsageData(parseResult.data),
    };
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
    const body = await manager.makeAuthenticatedRequest("chatgpt", API_URL);
    const data = JSON.parse(body);
    const parseResult = ChatGPTUsageResponseSchema.safeParse(data);

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

    return {
      ok: true,
      value: toServiceUsageData(parseResult.data),
    };
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
 * ChatGPT service adapter
 */
export const chatGPTAdapter: ServiceAdapter = {
  name: "ChatGPT",

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
