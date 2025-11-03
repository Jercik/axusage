import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { toServiceUsageData } from "./parse-claude-usage.js";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";

const API_URL = "https://api.anthropic.com/api/oauth/usage";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const manager = new BrowserAuthManager();
    try {
      const body = await manager.makeAuthenticatedRequest("claude", API_URL);
      const data = JSON.parse(body);
      const parseResult = UsageResponseSchema.safeParse(data);

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
      const message = error instanceof Error ? error.message : String(error);
      const hint = message.includes("401")
        ? "Claude usage is not exposed via Console session. The only documented programmatic access is the Admin Usage API, which requires an Admin API key."
        : undefined;
      return {
        ok: false,
        error: new ApiError(
          hint
            ? `${message}. ${hint}`
            : `Browser authentication failed: ${message}`,
        ),
      };
    } finally {
      await manager.close();
    }
  },
};
