import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { ChatGPTUsageResponse as ChatGPTUsageResponseSchema } from "../types/chatgpt.js";
import { toServiceUsageData } from "./parse-chatgpt-usage.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

/** Functional core is extracted to ./parse-chatgpt-usage.ts */

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
