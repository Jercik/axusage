import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type { UsageResponse } from "../types/usage.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";

const API_URL = "https://api.anthropic.com/api/oauth/usage";
const BETA_VERSION = "oauth-2025-04-20";

/**
 * Period durations for Claude usage windows
 */
const CLAUDE_PERIOD_DURATIONS = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000,
  seven_day_oauth_apps: 7 * 24 * 60 * 60 * 1000,
  seven_day_opus: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Converts Claude response to common domain model
 */
function toServiceUsageData(response: UsageResponse): ServiceUsageData {
  return {
    service: "Claude",
    windows: [
      {
        name: "5-Hour Usage",
        utilization: response.five_hour.utilization,
        resetsAt: new Date(response.five_hour.resets_at),
        periodDurationMs: CLAUDE_PERIOD_DURATIONS.five_hour,
      },
      {
        name: "7-Day Usage",
        utilization: response.seven_day.utilization,
        resetsAt: new Date(response.seven_day.resets_at),
        periodDurationMs: CLAUDE_PERIOD_DURATIONS.seven_day,
      },
      ...(response.seven_day_oauth_apps
        ? [
            {
              name: "7-Day OAuth Apps",
              utilization: response.seven_day_oauth_apps.utilization,
              resetsAt: new Date(response.seven_day_oauth_apps.resets_at),
              periodDurationMs: CLAUDE_PERIOD_DURATIONS.seven_day_oauth_apps,
            },
          ]
        : []),
      {
        name: "7-Day Opus Usage",
        utilization: response.seven_day_opus.utilization,
        resetsAt: new Date(response.seven_day_opus.resets_at),
        periodDurationMs: CLAUDE_PERIOD_DURATIONS.seven_day_opus,
      },
    ],
  };
}

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
