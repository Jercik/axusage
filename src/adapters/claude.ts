import { z } from "zod";

import type {
  Result,
  ServiceAdapter,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { getServiceAccessToken } from "../services/get-service-access-token.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { coalesceClaudeUsageResponse } from "./coalesce-claude-usage-response.js";
import { toServiceUsageData } from "./parse-claude-usage.js";

const USAGE_API_URL = "https://api.anthropic.com/api/oauth/usage";
const PROFILE_API_URL = "https://api.anthropic.com/api/oauth/profile";
const ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";

/** Map organization_type to display name */
const PLAN_TYPE_MAP: Record<string, string> = {
  claude_max: "Max",
  claude_pro: "Pro",
  claude_enterprise: "Enterprise",
  claude_team: "Team",
};

/** Fetch plan type from profile endpoint (best effort) */
async function fetchPlanType(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch(PROFILE_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "anthropic-beta": ANTHROPIC_BETA_HEADER,
      },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as {
      organization?: { organization_type?: string };
    };
    const orgType = data.organization?.organization_type;
    return orgType ? (PLAN_TYPE_MAP[orgType] ?? orgType) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Claude service adapter using direct API access.
 *
 * This adapter uses the OAuth token from Claude Code's credential store
 * (Keychain on macOS, credentials file elsewhere) to make direct API calls
 * to the Anthropic usage endpoint.
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const accessToken = await getServiceAccessToken("claude");

    if (!accessToken) {
      return {
        ok: false,
        error: new ApiError(
          "No Claude credentials found. Run 'claude' to authenticate.",
        ),
      };
    }

    try {
      const [response, planType] = await Promise.all([
        fetch(USAGE_API_URL, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "anthropic-beta": ANTHROPIC_BETA_HEADER,
          },
        }),
        fetchPlanType(accessToken),
      ]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          ok: false,
          error: new ApiError(
            `Claude API request failed: ${String(response.status)} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
            response.status,
          ),
        };
      }

      const data: unknown = await response.json();
      const parseResult = UsageResponseSchema.safeParse(
        coalesceClaudeUsageResponse(data) ?? data,
      );

      if (!parseResult.success) {
        /* eslint-disable unicorn/no-null -- JSON.stringify requires null for no replacer */
        console.error("Raw API response:", JSON.stringify(data, null, 2));
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

      const usageData = toServiceUsageData(parseResult.data);
      return {
        ok: true,
        value: planType ? { ...usageData, planType } : usageData,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: new ApiError(`Failed to fetch Claude usage: ${message}`),
      };
    }
  },
};
