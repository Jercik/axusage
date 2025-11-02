import type {
  ServiceAdapter,
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
 * ChatGPT service adapter
 */
export const chatGPTAdapter: ServiceAdapter = {
  name: "ChatGPT",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
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
  },
};
