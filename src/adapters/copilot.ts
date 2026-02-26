import type {
  ServiceUsageFetcher,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { CopilotUsageResponse as CopilotUsageResponseSchema } from "../types/copilot.js";
import { toServiceUsageData } from "./parse-copilot-usage.js";

// Internal/undocumented GitHub API used by VS Code, JetBrains, and other
// first-party Copilot integrations. May change without notice.
const API_URL = "https://api.github.com/copilot_internal/user";

/** Fetch GitHub Copilot usage data using a pre-resolved access token */
async function fetchCopilotUsageWithToken(
  accessToken: string,
): Promise<Result<ServiceUsageData, ApiError>> {
  try {
    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        error: new ApiError(
          `GitHub Copilot API request failed: ${String(response.status)} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
          response.status,
        ),
      };
    }

    const data: unknown = await response.json();
    const parseResult = CopilotUsageResponseSchema.safeParse(data);

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
    return {
      ok: false,
      error: new ApiError(`Failed to fetch GitHub Copilot usage: ${message}`),
    };
  }
}

export const copilotUsageFetcher: ServiceUsageFetcher = {
  name: "GitHub Copilot",
  fetchUsageWithToken: fetchCopilotUsageWithToken,
};
