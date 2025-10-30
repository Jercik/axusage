import type { ServiceUsageData } from "../types/domain.js";
import type { UsageResponse } from "../types/usage.js";

/**
 * Period durations for Claude usage windows
 */
export const CLAUDE_PERIOD_DURATIONS = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000,
  seven_day_oauth_apps: 7 * 24 * 60 * 60 * 1000,
  seven_day_opus: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Converts Claude response to common domain model
 */
export function toServiceUsageData(response: UsageResponse): ServiceUsageData {
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
