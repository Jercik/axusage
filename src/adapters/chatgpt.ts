import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type {
  ChatGPTUsageResponse,
  ChatGPTRateLimitWindow,
} from "../types/chatgpt.js";
import { ChatGPTUsageResponse as ChatGPTUsageResponseSchema } from "../types/chatgpt.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

/**
 * Converts a ChatGPT rate limit window to common usage window
 */
function toUsageWindow(
  name: string,
  window: ChatGPTRateLimitWindow,
): {
  name: string;
  utilization: number;
  resetsAt: Date;
  periodDurationMs: number;
} {
  return {
    name,
    utilization: window.used_percent,
    resetsAt: new Date(window.reset_at * 1000), // Convert Unix timestamp to Date
    periodDurationMs: window.limit_window_seconds * 1000,
  };
}

/**
 * Converts ChatGPT response to common domain model
 */
function toServiceUsageData(response: ChatGPTUsageResponse): ServiceUsageData {
  return {
    service: "ChatGPT",
    planType: response.plan_type,
    windows: [
      toUsageWindow(
        "Primary Window (~5 hours)",
        response.rate_limit.primary_window,
      ),
      toUsageWindow(
        "Secondary Window (~7 days)",
        response.rate_limit.secondary_window,
      ),
    ],
    metadata: {
      allowed: response.rate_limit.allowed,
      limitReached: response.rate_limit.limit_reached,
    },
  };
}

/**
 * ChatGPT service adapter
 */
export const chatGPTAdapter: ServiceAdapter = {
  name: "ChatGPT",

  async fetchUsage(
    config: ServiceConfig,
  ): Promise<Result<ServiceUsageData, ApiError>> {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          "content-type": "application/json",
          accept: "*/*",
        },
      });

      if (!response.ok) {
        const body = await response
          .text()
          .catch(() => "Unable to read response");
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
  },
};
