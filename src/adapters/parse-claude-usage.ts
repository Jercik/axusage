import type { ServiceUsageData } from "../types/domain.js";
import { z } from "zod";
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

// Intentionally avoid sentinel timestamps for missing reset dates.
// If a reset date is unavailable, coalescing will fail and return undefined
// so the caller can handle the unsupported shape explicitly.

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

/**
 * Best-effort coalescing for array-shaped Claude usage responses.
 *
 * Notes:
 * - Requires 5-hour, 7-day, and 7-day Opus windows; otherwise returns undefined.
 * - OAuth apps window is optional in the schema and will only be included
 *   when present in the source data.
 */
export function coalesceArrayToUsageResponse(
  data: unknown,
): UsageResponse | undefined {
  if (!Array.isArray(data)) return undefined;
  const Item = z.object({
    window: z.string().optional(),
    period: z.string().optional(),
    name: z.string().optional(),
    key: z.string().optional(),
    utilization: z.number().optional(),
    percentage: z.number().optional(),
    percent: z.number().optional(),
    resets_at: z.string().optional(),
    reset_at: z.string().optional(),
    resetsAt: z.string().optional(),
    resetAt: z.string().optional(),
  });
  const arrayParse = z.array(Item).safeParse(data);
  if (!arrayParse.success) return undefined;
  const items = arrayParse.data;
  const keyOf = (it: z.infer<typeof Item>) =>
    (it.window || it.period || it.name || it.key || "").toLowerCase();
  const metricOf = (
    it: Partial<z.infer<typeof Item>>,
  ): { utilization: number; resets_at: string } | undefined => {
    const resetsAt = it.resets_at ?? it.reset_at ?? it.resetsAt ?? it.resetAt;
    if (!resetsAt) return undefined;
    return {
      utilization: it.utilization ?? it.percentage ?? it.percent ?? 0,
      resets_at: resetsAt,
    };
  };
  const pick = (...match: string[]) => {
    const matches = (it: z.infer<typeof Item>) => {
      const key = keyOf(it);
      if (match.includes(key)) return true; // exact
      const tokens = new Set(key.split(/[^a-z0-9]+/gu).filter(Boolean));
      return match.some((m) => tokens.has(m));
    };
    const cand = items.find((it) => matches(it));
    return cand ? metricOf(cand) : undefined;
  };
  const fiveHour = pick("five_hour", "five", "5", "5hour");
  const sevenDay = pick("seven_day", "seven", "7", "week");
  const sevenDayOpus = pick("seven_day_opus", "opus");
  const sevenDayOauth = pick("seven_day_oauth_apps", "oauth");

  // Only return a coalesced response when all required windows are found.
  if (!fiveHour || !sevenDay || !sevenDayOpus) return undefined;
  const result: {
    five_hour: NonNullable<typeof fiveHour>;
    seven_day: NonNullable<typeof sevenDay>;
    seven_day_opus: NonNullable<typeof sevenDayOpus>;
    seven_day_oauth_apps?: NonNullable<typeof sevenDayOauth> | null;
  } = {
    five_hour: fiveHour,
    seven_day: sevenDay,
    seven_day_opus: sevenDayOpus,
  };
  if (sevenDayOauth) result.seven_day_oauth_apps = sevenDayOauth;
  return result satisfies UsageResponse;
}
