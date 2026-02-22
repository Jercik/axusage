import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { CopilotUsageResponse as CopilotUsageResponseSchema } from "../types/copilot.js";
import { toServiceUsageData } from "./parse-copilot-usage.js";
import { getServiceAccessToken } from "../services/get-service-access-token.js";

const API_URL = "https://api.github.com/copilot_internal/user";

/**
 * GitHub Copilot service adapter using token-based API access.
 *
 * Credentials resolved via getServiceAccessToken (vault, local axauth, gh CLI).
 */
export const copilotAdapter: ServiceAdapter = {
  name: "GitHub Copilot",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const accessToken = await getServiceAccessToken("copilot");

    if (!accessToken) {
      return {
        ok: false,
        error: new ApiError(
          "No GitHub Copilot credentials found. Run 'gh auth login' to authenticate.",
        ),
      };
    }

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
  },
};
