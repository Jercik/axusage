import chalk from "chalk";
import type { ServiceUsageData, UsageWindow } from "#types/domain";

/**
 * Formats a utilization value as a percentage string
 */
export function formatUtilization(utilization: number): string {
  return `${utilization.toFixed(2)}%`;
}

/**
 * Formats a Date as a human-readable date string
 */
export function formatResetTime(date: Date): string {
  return date.toLocaleString();
}

/**
 * Calculates usage rate based on time elapsed vs usage consumed
 */
function calculateUsageRate(
  utilization: number,
  resetsAt: Date,
  periodDurationMs: number,
): number {
  const now = Date.now();
  const resetTime = resetsAt.getTime();
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
  resetsAt: Date,
  periodDurationMs: number,
): (text: string) => string {
  const rate = calculateUsageRate(utilization, resetsAt, periodDurationMs);

  if (rate > 1.5) return chalk.red;
  if (rate > 1.0) return chalk.yellow;
  return chalk.green;
}

/**
 * Formats a single usage window for display
 */
export function formatUsageWindow(window: UsageWindow): string {
  const utilizationStr = formatUtilization(window.utilization);
  const coloredUtilization = getUtilizationColor(
    window.utilization,
    window.resetsAt,
    window.periodDurationMs,
  )(utilizationStr);
  const resetTime = formatResetTime(window.resetsAt);

  const rate = calculateUsageRate(
    window.utilization,
    window.resetsAt,
    window.periodDurationMs,
  );
  const rateStr = rate.toFixed(2);

  return `${chalk.bold(window.name)}:
  Utilization: ${coloredUtilization} (${rateStr}x rate)
  Resets at:   ${resetTime}`;
}

/**
 * Formats complete service usage data for human-readable display
 */
export function formatServiceUsageData(data: ServiceUsageData): string {
  const header = [
    chalk.cyan.bold(`=== ${data.service} Usage ===`),
    data.planType ? chalk.gray(`Plan: ${data.planType}`) : null,
    data.metadata?.limitReached === true
      ? chalk.red("⚠ Rate limit reached")
      : data.metadata?.allowed === false
        ? chalk.red("⚠ Usage not allowed")
        : null,
  ]
    .filter(Boolean)
    .join("\n");

  const windows = data.windows.map(formatUsageWindow).join("\n\n");

  return `${header}\n\n${windows}`;
}

/**
 * Formats service usage data as JSON
 */
export function formatServiceUsageDataAsJson(
  data: ServiceUsageData,
  windowName?: string,
): string {
  if (windowName) {
    const window = data.windows.find((w) =>
      w.name.toLowerCase().includes(windowName.toLowerCase()),
    );
    if (window) {
      return JSON.stringify(
        {
          name: window.name,
          utilization: window.utilization,
          resetsAt: window.resetsAt.toISOString(),
          periodDurationMs: window.periodDurationMs,
        },
        null,
        2,
      );
    }
    return JSON.stringify(
      { error: `Window "${windowName}" not found` },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      service: data.service,
      planType: data.planType,
      windows: data.windows.map((w) => ({
        name: w.name,
        utilization: w.utilization,
        resetsAt: w.resetsAt.toISOString(),
        periodDurationMs: w.periodDurationMs,
      })),
      metadata: data.metadata,
    },
    null,
    2,
  );
}
