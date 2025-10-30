import type { ServiceUsageData } from "../types/domain.js";
import type { GitHubCopilotUsageResponse } from "../types/github-copilot.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parses GitHub reset date (YYYY-MM-DD) into a UTC Date
 */
export function parseResetDate(resetDateString: string): Date {
  const parts = resetDateString.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid reset date format: ${resetDateString}`);
  }

  const [yearString, monthString, dayString] = parts;
  if (!yearString || !monthString || !dayString) {
    throw new Error(`Invalid reset date components: ${resetDateString}`);
  }

  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid reset date components: ${resetDateString}`);
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Calculates monthly period duration ending at the reset date
 *
 * Determines the period start by going back one month from the reset
 * date and clamping the day to the last valid day of that previous
 * month. This handles edge cases like Jan 31 → Feb 28/29 where the
 * target month has fewer days than the reset date's day component.
 */
export function calculatePeriodDuration(resetDate: Date): number {
  const periodEnd = resetDate.getTime();
  // Determine previous month and clamp day to its last day
  const year = resetDate.getUTCFullYear();
  const month = resetDate.getUTCMonth(); // 0-based
  const day = resetDate.getUTCDate();

  // First day of current month in UTC
  const firstOfCurrentMonth = Date.UTC(year, month, 1, 0, 0, 0);
  // Last day of previous month: subtract 1 day from first of current month
  const lastPrevMonthDate = new Date(firstOfCurrentMonth - MS_PER_DAY);
  const lastPrevMonthDay = lastPrevMonthDate.getUTCDate();
  const prevMonth = lastPrevMonthDate.getUTCMonth();
  const prevYear = lastPrevMonthDate.getUTCFullYear();

  const targetDay = Math.min(day, lastPrevMonthDay);
  const periodStart = Date.UTC(prevYear, prevMonth, targetDay, 0, 0, 0);

  return Math.max(periodEnd - periodStart, 0);
}

/**
 * Converts GitHub Copilot response to common domain model
 */
export function toServiceUsageData(
  response: GitHubCopilotUsageResponse,
): ServiceUsageData {
  const resetDate = parseResetDate(response.quotas.resetDate);
  const periodDurationMs = calculatePeriodDuration(resetDate);

  const used =
    response.quotas.limits.premiumInteractions -
    response.quotas.remaining.premiumInteractions;
  const utilization = (used / response.quotas.limits.premiumInteractions) * 100;

  return {
    service: "GitHub Copilot",
    planType: response.plan,
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
