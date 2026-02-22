import type { ServiceUsageData } from "../types/domain.js";
import type { CopilotUsageResponse } from "../types/copilot.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculates monthly period duration ending at the reset date.
 *
 * Determines the period start by going back one month from the reset
 * date and clamping the day to the last valid day of that previous
 * month. This handles edge cases like Jan 31 → Feb 28/29 where the
 * target month has fewer days than the reset date's day component.
 */
export function calculatePeriodDuration(resetDate: Date): number {
  const periodEnd = resetDate.getTime();
  const year = resetDate.getUTCFullYear();
  const month = resetDate.getUTCMonth();
  const day = resetDate.getUTCDate();

  const firstOfCurrentMonth = Date.UTC(year, month, 1, 0, 0, 0);
  const lastPreviousMonthDate = new Date(firstOfCurrentMonth - MS_PER_DAY);
  const lastPreviousMonthDay = lastPreviousMonthDate.getUTCDate();
  const previousMonth = lastPreviousMonthDate.getUTCMonth();
  const previousYear = lastPreviousMonthDate.getUTCFullYear();

  const targetDay = Math.min(day, lastPreviousMonthDay);
  const periodStart = Date.UTC(
    previousYear,
    previousMonth,
    targetDay,
    resetDate.getUTCHours(),
    resetDate.getUTCMinutes(),
    resetDate.getUTCSeconds(),
    resetDate.getUTCMilliseconds(),
  );

  return Math.max(periodEnd - periodStart, 0);
}

/**
 * Converts GitHub Copilot API response to common domain model.
 */
export function toServiceUsageData(
  response: CopilotUsageResponse,
): ServiceUsageData {
  const { premium_interactions } = response.quota_snapshots;

  if (premium_interactions.unlimited) {
    return {
      service: "GitHub Copilot",
      planType: response.copilot_plan,
      windows: [
        {
          name: "Monthly Premium Interactions",
          utilization: 0,
          resetsAt: undefined,
          periodDurationMs: 0,
        },
      ],
    };
  }

  const resetDate = new Date(response.quota_reset_date_utc);
  const periodDurationMs = calculatePeriodDuration(resetDate);

  const used =
    premium_interactions.entitlement - premium_interactions.remaining;
  const utilization =
    premium_interactions.entitlement === 0
      ? 0
      : (used / premium_interactions.entitlement) * 100;

  return {
    service: "GitHub Copilot",
    planType: response.copilot_plan,
    windows: [
      {
        name: "Monthly Premium Interactions",
        utilization: Math.round(utilization * 100) / 100,
        resetsAt: resetDate,
        periodDurationMs,
      },
    ],
  };
}
