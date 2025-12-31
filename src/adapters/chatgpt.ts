import { extractRawCredentials, getAccessToken } from "axauth";

import type {
  Result,
  ServiceAdapter,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { ChatGPTUsageResponse as ChatGPTUsageResponseSchema } from "../types/chatgpt.js";
import { toServiceUsageData } from "./parse-chatgpt-usage.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

/**
 * ChatGPT service adapter using direct API access.
 *
 * Uses the OAuth token from Codex CLI's credential store (~/.codex/auth.json)
 * to make direct API calls to ChatGPT's usage endpoint.
 */
export const chatGPTAdapter: ServiceAdapter = {
  name: "ChatGPT",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const credentials = extractRawCredentials("codex");

    if (!credentials) {
      return {
        ok: false,
        error: new ApiError(
          "No Codex credentials found. Run 'codex' to authenticate.",
        ),
      };
    }

    if (credentials.type !== "oauth") {
      return {
        ok: false,
        error: new ApiError(
          "ChatGPT usage API requires OAuth authentication. API key authentication is not supported for usage data.",
        ),
      };
    }

    const accessToken = getAccessToken(credentials);
    if (!accessToken) {
      return {
        ok: false,
        error: new ApiError("Invalid OAuth credentials: missing access token."),
      };
    }

    try {
      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          ok: false,
          error: new ApiError(
            `ChatGPT API request failed: ${String(response.status)} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
            response.status,
          ),
        };
      }

      const data: unknown = await response.json();
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
          `Failed to fetch ChatGPT usage: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  },
};
