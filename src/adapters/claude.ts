import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { toServiceUsageData } from "./parse-claude-usage.js";
import { coalesceClaudeUsageResponse } from "./coalesce-claude-usage-response.js";
import {
  acquireAuthManager,
  releaseAuthManager,
} from "../services/shared-browser-auth-manager.js";
import { z } from "zod";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter using browser-based fetching.
 *
 * This adapter uses Playwright to navigate to the Claude usage page and
 * intercept the API response. Direct HTTP requests don't work reliably
 * because Cloudflare's bot protection requires a real browser context.
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
      // For Claude, makeAuthenticatedRequest uses browser-based fetching which
      // navigates to the usage page and intercepts the API response. The URL
      // parameter is required by the interface but not used for Claude requests.
      const body = await manager.makeAuthenticatedRequest(
        "claude",
        "https://claude.ai/api/organizations",
      );
      const data: unknown = JSON.parse(body);
      const parseResult = UsageResponseSchema.safeParse(
        coalesceClaudeUsageResponse(data) ?? data,
      );

      if (!parseResult.success) {
        // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null for no replacer
        console.error("Raw API response:", JSON.stringify(data, null, 2));
        /* eslint-disable unicorn/no-null -- JSON.stringify requires null for no replacer */
        console.error(
          "Validation errors:",
          JSON.stringify(z.treeifyError(parseResult.error), null, 2),
        );
        /* eslint-enable unicorn/no-null */
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
      const is401 = /\b401\b/u.test(message);
      const hint = is401
        ? " Note: Claude usage data requires a browser session. The Admin Usage API (api.anthropic.com) requires an Admin API key for programmatic access."
        : "";
      return {
        ok: false,
        error: new ApiError(`Browser authentication failed: ${message}${hint}`),
      };
    } finally {
      await releaseAuthManager();
    }
  },
};
