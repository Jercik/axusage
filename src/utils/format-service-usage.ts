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
function formatResetTime(date: Date | undefined): string {
  return date ? date.toLocaleString() : "Not available";
}

/**
 * Gets color for utilization based on usage rate
 * Green: on track or under (rate ≤ 1.0)
 * Yellow: slightly over budget (1.0 < rate ≤ 1.5)
 * Red: significantly over budget (rate > 1.5)
 */
function getUtilizationColor(
  rate: number | undefined,
): (text: string) => string {
  if (rate === undefined) return chalk.gray;
  const bucket = classifyUsageRate(rate);
  if (bucket === "red") return chalk.red;
  if (bucket === "yellow") return chalk.yellow;
  return chalk.green;
}

/**
 * Formats a single usage window for display
 */
function formatUsageWindow(window: UsageWindow): string {
  const utilizationString = formatUtilization(window.utilization);
  const rate = calculateUsageRate(
    window.utilization,
    window.resetsAt,
    window.periodDurationMs,
  );
  const coloredUtilization = getUtilizationColor(rate)(utilizationString);
  const resetTime = formatResetTime(window.resetsAt);
  // Build full display string for rate to keep formatting consistent
  const rateDisplay =
    rate === undefined ? "Not available" : `${rate.toFixed(2)}x rate`;

  return `${chalk.bold(window.name)}:
  Utilization: ${coloredUtilization} (${rateDisplay})
  Resets at:   ${resetTime}`;
}

/**
 * Formats complete service usage data for human-readable display
 */
export function formatServiceUsageData(data: ServiceUsageData): string {
  const header = [
    chalk.cyan.bold(`=== ${data.service} Usage ===`),
    data.planType ? chalk.gray(`Plan: ${data.planType}`) : undefined,
    data.metadata?.limitReached === true
      ? chalk.red("⚠ Rate limit reached")
      : data.metadata?.allowed === false
        ? chalk.red("⚠ Usage not allowed")
        : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const windows = data.windows
    .map((window) => formatUsageWindow(window))
    .join("\n\n");

  return `${header}\n\n${windows}`;
}

/**
 * Converts service usage data to a plain JSON-serializable object
 */
export function toJsonObject(data: ServiceUsageData): unknown {
  return {
    service: data.service,
    planType: data.planType,
    windows: data.windows.map((w) => ({
      name: w.name,
      utilization: w.utilization,
      resetsAt: w.resetsAt?.toISOString(),
      periodDurationMs: w.periodDurationMs,
    })),
    metadata: data.metadata,
  };
}

/**
 * Formats service usage data as JSON string
 */
export function formatServiceUsageDataAsJson(data: ServiceUsageData): string {
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null for no replacer
  return JSON.stringify(toJsonObject(data), null, 2);
}

const TSV_HEADER = "SERVICE\tPLAN\tWINDOW\tUTILIZATION\tRATE\tRESETS_AT";

/**
 * Sanitizes a string for TSV output by replacing tabs and newlines with spaces.
 */
function sanitizeForTsv(value: string): string {
  return value.replaceAll(/[\t\n\r]/gu, " ");
}

/**
 * Formats a single service's usage data as TSV rows (no header).
 * One row per usage window.
 */
function formatServiceUsageRowsAsTsv(data: ServiceUsageData): string[] {
  return data.windows.map((w) => {
    const rate = calculateUsageRate(
      w.utilization,
      w.resetsAt,
      w.periodDurationMs,
    );
    return [
      sanitizeForTsv(data.service),
      sanitizeForTsv(data.planType ?? "-"),
      sanitizeForTsv(w.name),
      w.utilization.toFixed(2),
      rate?.toFixed(2) ?? "-",
      w.resetsAt?.toISOString() ?? "-",
    ].join("\t");
  });
}

/**
 * Formats multiple services' usage data as TSV with header.
 * One row per usage window, tab-delimited, UPPERCASE headers.
 */
export function formatServiceUsageAsTsv(data: ServiceUsageData[]): string {
  const rows = data.flatMap((d) => formatServiceUsageRowsAsTsv(d));
  return [TSV_HEADER, ...rows].join("\n");
}
