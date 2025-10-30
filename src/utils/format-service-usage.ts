import chalk from "chalk";
import type { ServiceUsageData, UsageWindow } from "../types/domain.js";
import { calculateUsageRate } from "./calculate-usage-rate.js";
import { classifyUsageRate } from "./classify-usage-rate.js";

/**
 * Formats a utilization value as a percentage string
 */
function formatUtilization(utilization: number): string {
  return `${utilization.toFixed(2)}%`;
}

/**
 * Formats a Date as a human-readable date string
 */
function formatResetTime(date: Date): string {
  return date.toLocaleString();
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
  const bucket = classifyUsageRate(rate);
  if (bucket === "red") return chalk.red;
  if (bucket === "yellow") return chalk.yellow;
  return chalk.green;
}

/**
 * Formats a single usage window for display
 */
function formatUsageWindow(window: UsageWindow): string {
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
 * Converts service usage data to a plain JSON-serializable object
 */
export function toJsonObject(
  data: ServiceUsageData,
  windowName?: string,
): unknown {
  if (windowName) {
    const window = data.windows.find((w) =>
      w.name.toLowerCase().includes(windowName.toLowerCase()),
    );
    if (window) {
      return {
        name: window.name,
        utilization: window.utilization,
        resetsAt: window.resetsAt.toISOString(),
        periodDurationMs: window.periodDurationMs,
      };
    }
    return { error: `Window "${windowName}" not found` };
  }

  return {
    service: data.service,
    planType: data.planType,
    windows: data.windows.map((w) => ({
      name: w.name,
      utilization: w.utilization,
      resetsAt: w.resetsAt.toISOString(),
      periodDurationMs: w.periodDurationMs,
    })),
    metadata: data.metadata,
  };
}

/**
 * Formats service usage data as JSON string
 */
export function formatServiceUsageDataAsJson(
  data: ServiceUsageData,
  windowName?: string,
): string {
  return JSON.stringify(toJsonObject(data, windowName), null, 2);
}
