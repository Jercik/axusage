import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { toServiceUsageData } from "./parse-claude-usage.js";

const API_URL = "https://api.anthropic.com/api/oauth/usage";
const BETA_VERSION = "oauth-2025-04-20";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(
    config: ServiceConfig,
  ): Promise<Result<ServiceUsageData, ApiError>> {
    try {
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          authorization: `Bearer ${config.accessToken}`,
          "anthropic-beta": BETA_VERSION,
          "content-type": "application/json",
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
      const parseResult = UsageResponseSchema.safeParse(data);

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
