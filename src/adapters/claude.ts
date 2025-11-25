import { existsSync } from "node:fs";
import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { toServiceUsageData } from "./parse-claude-usage.js";
import { coalesceClaudeUsageResponse } from "./coalesce-claude-usage-response.js";
import { fetchClaudeUsage } from "../services/fetch-claude-usage.js";
import { getBrowserContextsDirectory } from "../services/app-paths.js";
import { getStorageStatePathFor } from "../services/auth-storage-path.js";
import { z } from "zod";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter using HTTP requests with session cookies.
 *
 * This adapter uses Playwright-stored cookies to make direct HTTP requests
 * to Claude's API for fetching usage data.
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const dataDirectory = getBrowserContextsDirectory();
    const cookiePath = getStorageStatePathFor(dataDirectory, "claude");

    if (!existsSync(cookiePath)) {
      return {
        ok: false,
        error: new ApiError(
          "No saved authentication for claude. Run 'agent-usage auth setup claude' first.",
        ),
      };
    }

    try {
      const body = await fetchClaudeUsage(cookiePath);
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
      let status: number | undefined;
      if (typeof error === "object" && error !== null) {
        const errorObject = error as Record<string, unknown>;
        const s = errorObject.status;
        const sc = errorObject.statusCode;
        if (typeof s === "number") status = s;
        else if (typeof sc === "number") status = sc;
      }
      // Be precise: avoid brittle substring matching for status codes
      // Match standalone 401 or 401 followed by a non-digit/end (handles "HTTP 401", "status:401", etc.)
      const is401 = status === 401 || /(?:\b401\b|401(?=\D|$))/u.test(message);
      const hint = is401
        ? "Claude usage is not exposed via Console session. The only documented programmatic access is the Admin Usage API, which requires an Admin API key."
        : undefined;
      return {
        ok: false,
        error: new ApiError(
          hint ? `${message}. ${hint}` : `HTTP fetch failed: ${message}`,
        ),
      };
    }
  },
};
