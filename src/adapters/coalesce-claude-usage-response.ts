import { z } from "zod";
import type { UsageResponse } from "../types/usage.js";

const UsageWindowCandidate = z.object({
  window: z.string().optional(),
  period: z.string().optional(),
  name: z.string().optional(),
  key: z.string().optional(),
  utilization: z.number().optional(),
  percentage: z.number().optional(),
  percent: z.number().optional(),
  resets_at: z.union([z.string(), z.null()]).optional(),
  reset_at: z.union([z.string(), z.null()]).optional(),
  resetsAt: z.union([z.string(), z.null()]).optional(),
  resetAt: z.union([z.string(), z.null()]).optional(),
});

type UsageWindowCandidate = z.infer<typeof UsageWindowCandidate>;

const UsageWindowCandidates = z.array(UsageWindowCandidate);

/**
 * Tokenizes labels so we can match windows even when punctuation varies,
 * e.g. "7-day" vs "seven_day".
 */
const tokenizeLabel = (label: string): Set<string> =>
  new Set(label.split(/[^a-z0-9]+/gu).filter(Boolean));

const normaliseLabel = (candidate: UsageWindowCandidate): string =>
  (
    candidate.window ||
    candidate.period ||
    candidate.name ||
    candidate.key ||
    ""
  ).toLowerCase();

const resolveResetTimestamp = (
  candidate: UsageWindowCandidate,
): string | undefined => {
  const values = [
    candidate.resets_at,
    candidate.reset_at,
    candidate.resetsAt,
    candidate.resetAt,
  ];
  for (const value of values) {
    if (value === undefined) continue;
    return value === null ? undefined : value;
  }
  return undefined;
};

const resolveUtilization = (candidate: UsageWindowCandidate): number =>
  candidate.utilization ?? candidate.percentage ?? candidate.percent ?? 0;

const selectMetric = (
  candidates: readonly UsageWindowCandidate[],
  matchers: readonly string[],
): { utilization: number; resets_at: string | undefined } | undefined => {
  for (const candidate of candidates) {
    const label = normaliseLabel(candidate);
    if (!label) continue;
    const tokens = tokenizeLabel(label);
    const matches =
      matchers.includes(label) ||
      matchers.some((matcher) => tokens.has(matcher));
    if (!matches) continue;
    return {
      utilization: resolveUtilization(candidate),
      resets_at: resolveResetTimestamp(candidate),
    };
  }
  return undefined;
};

/**
 * Best-effort coalescing for array-shaped Claude usage responses.
 *
 * Notes:
 * - Requires 5-hour, 7-day, and 7-day Opus windows; otherwise returns undefined.
 * - OAuth apps window is optional in the schema and will only be included
 *   when present in the source data.
 */
export function coalesceClaudeUsageResponse(
  data: unknown,
): UsageResponse | undefined {
  if (!Array.isArray(data)) return undefined;
  const parsed = UsageWindowCandidates.safeParse(data);
  if (!parsed.success) return undefined;
  const candidates = parsed.data;

  const fiveHour = selectMetric(candidates, [
    "five_hour",
    "five",
    "5",
    "5hour",
  ]);
  const sevenDay = selectMetric(candidates, [
    "seven_day",
    "seven",
    "7",
    "week",
  ]);
  const sevenDayOpus = selectMetric(candidates, ["seven_day_opus", "opus"]);
  const sevenDayOauth = selectMetric(candidates, [
    "seven_day_oauth_apps",
    "oauth",
  ]);

  if (!fiveHour || !sevenDay || !sevenDayOpus) return undefined;

  const result: {
    five_hour: typeof fiveHour;
    seven_day: typeof sevenDay;
    seven_day_opus: typeof sevenDayOpus;
    seven_day_oauth_apps?: typeof sevenDayOauth;
  } = {
    five_hour: fiveHour,
    seven_day: sevenDay,
    seven_day_opus: sevenDayOpus,
  };
  if (sevenDayOauth) result.seven_day_oauth_apps = sevenDayOauth;

  return result satisfies UsageResponse;
}
