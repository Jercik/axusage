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

/**
 * Placeholder reset date used when an endpoint omits a concrete reset timestamp.
 * Far-future value avoids implying a recent reset.
 */
const PLACEHOLDER_RESET_DATE = "2099-12-31T00:00:00.000Z" as const;

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
 * Some Claude endpoints return an array of usage items instead of the
 * expected object. Attempt to coalesce common shapes into UsageResponse.
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
  const metricOf = (it: Partial<z.infer<typeof Item>>) => ({
    utilization: it.utilization ?? it.percentage ?? it.percent ?? 0,
    // Use a far-future timestamp as a safe placeholder when a reset
    // time is not provided rather than "now", which could falsely
    // imply a recent reset.
    resets_at:
      it.resets_at ??
      it.reset_at ??
      it.resetsAt ??
      it.resetAt ??
      PLACEHOLDER_RESET_DATE,
  });
  const pick = (...match: string[]) => {
    // Prefer exact key matches first to avoid unintended substring hits
    const exact = items.find((it) => match.includes(keyOf(it)));
    if (exact) return metricOf(exact);
    const found = items.find((it) => match.some((m) => keyOf(it).includes(m)));
    return found ? metricOf(found) : undefined;
  };
  const fiveHour = pick("five", "5-hour", "5hour");
  // Use specific identifiers; avoid generic '7' which could match 'seven_day_opus'
  const sevenDay = pick("seven_day", "7-day", "week");
  const sevenDayOpus = pick("opus");
  const sevenDayOauth = pick("oauth");

  // Only return a coalesced response when all required windows are found.
  if (!fiveHour || !sevenDay || !sevenDayOpus) return undefined;
  return {
    five_hour: fiveHour,
    seven_day: sevenDay,
    seven_day_oauth_apps: sevenDayOauth,
    seven_day_opus: sevenDayOpus,
  } satisfies UsageResponse;
}
