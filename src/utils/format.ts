import chalk from "chalk";
import type { UsageMetric, UsageResponse, UsageType } from "#types/usage";

/**
 * Period durations in milliseconds
 */
const PERIOD_DURATIONS = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000,
  seven_day_oauth_apps: 7 * 24 * 60 * 60 * 1000,
  seven_day_opus: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Formats a utilization value as a percentage string
 */
export function formatUtilization(utilization: number): string {
  return `${utilization.toFixed(2)}%`;
}

/**
 * Formats a timestamp as a human-readable date string
 */
export function formatResetTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Calculates usage rate based on time elapsed vs usage consumed
 */
function calculateUsageRate(
  utilization: number,
  resetsAt: string,
  periodDurationMs: number,
): number {
  const now = Date.now();
  const resetTime = new Date(resetsAt).getTime();
  const periodStart = resetTime - periodDurationMs;

  const elapsedTime = now - periodStart;
  const elapsedPercentage = (elapsedTime / periodDurationMs) * 100;

  // Avoid division by zero
  if (elapsedPercentage <= 0) return 0;

  // Usage rate: how much we're using compared to expected
  // Rate = actual_usage / expected_usage
  return utilization / elapsedPercentage;
}

/**
 * Gets color for utilization based on usage rate
 * Green: on track or under (rate ≤ 1.0)
 * Yellow: slightly over budget (1.0 < rate ≤ 1.5)
 * Red: significantly over budget (rate > 1.5)
 */
function getUtilizationColor(
  utilization: number,
  resetsAt: string,
  periodDurationMs: number,
): (text: string) => string {
  const rate = calculateUsageRate(utilization, resetsAt, periodDurationMs);

  if (rate > 1.5) return chalk.red;
  if (rate > 1.0) return chalk.yellow;
  return chalk.green;
}

/**
 * Formats a single usage metric for display
 */
function formatUsageMetric(
  label: string,
  metric: UsageMetric | null,
  periodDurationMs: number,
): string {
  if (metric === null) {
    return `${chalk.bold(label)}: ${chalk.gray("N/A")}`;
  }

  const utilizationStr = formatUtilization(metric.utilization);
  const coloredUtilization = getUtilizationColor(
    metric.utilization,
    metric.resets_at,
    periodDurationMs,
  )(utilizationStr);
  const resetTime = formatResetTime(metric.resets_at);

  const rate = calculateUsageRate(
    metric.utilization,
    metric.resets_at,
    periodDurationMs,
  );
  const rateStr = rate.toFixed(2);

  return `${chalk.bold(label)}:
  Utilization: ${coloredUtilization} (${rateStr}x rate)
  Resets at:   ${resetTime}`;
}

/**
 * Formats the complete usage response for human-readable display
 */
export function formatUsageResponse(response: UsageResponse): string {
  const sections = [
    formatUsageMetric(
      "5-Hour Usage",
      response.five_hour,
      PERIOD_DURATIONS.five_hour,
    ),
    formatUsageMetric(
      "7-Day Usage",
      response.seven_day,
      PERIOD_DURATIONS.seven_day,
    ),
    formatUsageMetric(
      "7-Day OAuth Apps",
      response.seven_day_oauth_apps,
      PERIOD_DURATIONS.seven_day_oauth_apps,
    ),
    formatUsageMetric(
      "7-Day Opus Usage",
      response.seven_day_opus,
      PERIOD_DURATIONS.seven_day_opus,
    ),
  ];

  return sections.join("\n\n");
}

const USAGE_TYPE_LABELS = {
  five_hour: "5-Hour Usage",
  seven_day: "7-Day Usage",
  seven_day_oauth_apps: "7-Day OAuth Apps",
  seven_day_opus: "7-Day Opus Usage",
} as const satisfies Record<UsageType, string>;

/**
 * Formats a specific usage type for display
 */
export function formatSpecificUsage(
  type: UsageType,
  response: UsageResponse,
): string {
  const label = USAGE_TYPE_LABELS[type];
  const periodDuration = PERIOD_DURATIONS[type];
  return formatUsageMetric(label, response[type], periodDuration);
}
