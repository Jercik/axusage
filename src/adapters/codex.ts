import type {
  Result,
  ServiceUsageFetcher,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { CodexUsageResponse as CodexUsageResponseSchema } from "../types/codex.js";
import { toServiceUsageData } from "./parse-codex-usage.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

/** Fetch ChatGPT usage data using a pre-resolved access token */
async function fetchCodexUsageWithToken(
  accessToken: string,
): Promise<Result<ServiceUsageData, ApiError>> {
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
    const parseResult = CodexUsageResponseSchema.safeParse(data);

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
}

export const codexUsageFetcher: ServiceUsageFetcher = {
  name: "ChatGPT",
  fetchUsageWithToken: fetchCodexUsageWithToken,
};
