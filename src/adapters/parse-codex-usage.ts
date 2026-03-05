import type { UsageWindow, ServiceUsageData } from "../types/domain.js";
import type {
  CodexUsageResponse,
  CodexRateLimitWindow,
  CodexAdditionalRateLimit,
} from "../types/codex.js";

/**
 * Converts a ChatGPT rate limit window to common usage window
 */
export function toUsageWindow(
  name: string,
  window: CodexRateLimitWindow,
): {
  name: string;
  utilization: number;
  resetsAt: Date;
  periodDurationMs: number;
} {
  return {
    name,
    utilization: window.used_percent,
    resetsAt: new Date(window.reset_at * 1000),
    periodDurationMs: window.limit_window_seconds * 1000,
  };
}

/**
 * Formats a human-readable label from the limit_name or metered_feature
 */
function formatAdditionalLimitLabel(limit: CodexAdditionalRateLimit): string {
  return limit.limit_name || limit.metered_feature;
}

/**
 * Converts an additional rate limit entry to usage windows
 */
export function toAdditionalWindows(
  limit: CodexAdditionalRateLimit,
): readonly UsageWindow[] {
  const label = formatAdditionalLimitLabel(limit);
  const rateLimit = limit.rate_limit;
  if (!rateLimit) return [];

  const windows: UsageWindow[] = [];
  if (rateLimit.primary_window) {
    windows.push(toUsageWindow(`${label} (primary)`, rateLimit.primary_window));
  }
  if (rateLimit.secondary_window) {
    windows.push(
      toUsageWindow(`${label} (secondary)`, rateLimit.secondary_window),
    );
  }
  return windows;
}

/**
 * Converts ChatGPT response to common domain model
 */
export function toServiceUsageData(
  response: CodexUsageResponse,
): ServiceUsageData {
  const windows: UsageWindow[] = [
    toUsageWindow(
      "Primary Window (~5 hours)",
      response.rate_limit.primary_window,
    ),
    toUsageWindow(
      "Secondary Window (~7 days)",
      response.rate_limit.secondary_window,
    ),
  ];

  if (response.additional_rate_limits) {
    for (const limit of response.additional_rate_limits) {
      windows.push(...toAdditionalWindows(limit));
    }
  }

  return {
    service: "ChatGPT",
    serviceType: "codex",
    planType: response.plan_type,
    windows,
    metadata: {
      allowed: response.rate_limit.allowed,
      limitReached: response.rate_limit.limit_reached,
    },
  };
}
