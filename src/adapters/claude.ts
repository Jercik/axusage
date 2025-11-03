import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import {
  toServiceUsageData,
  coalesceArrayToUsageResponse,
} from "./parse-claude-usage.js";
import {
  acquireAuthManager,
  releaseAuthManager,
} from "../services/shared-browser-auth-manager.js";

const API_URL = "https://api.anthropic.com/api/oauth/usage";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const manager = acquireAuthManager();
    try {
      if (!manager.hasAuth("claude")) {
        return {
          ok: false,
          error: new ApiError(
            "No saved authentication for claude. Run 'agent-usage auth setup claude' first.",
          ),
        };
      }
      const body = await manager.makeAuthenticatedRequest("claude", API_URL);
      const data = JSON.parse(body);
      const parseResult = UsageResponseSchema.safeParse(
        coalesceArrayToUsageResponse(data) ?? data,
      );

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
      let status: number | undefined;
      if (typeof error === "object" && error !== null) {
        const errorObject = error as Record<string, unknown>;
        const s = errorObject.status;
        const sc = errorObject.statusCode;
        if (typeof s === "number") status = s;
        else if (typeof sc === "number") status = sc;
      }
      const is401 = status === 401 || message.includes("401");
      const hint = is401
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
      await releaseAuthManager();
    }
  },
};
