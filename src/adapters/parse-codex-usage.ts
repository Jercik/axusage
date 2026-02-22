import type { ServiceUsageData } from "../types/domain.js";
import type {
  CodexUsageResponse,
  CodexRateLimitWindow,
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
 * Converts ChatGPT response to common domain model
 */
export function toServiceUsageData(
  response: CodexUsageResponse,
): ServiceUsageData {
  return {
    service: "ChatGPT",
    planType: response.plan_type,
    windows: [
      toUsageWindow(
        "Primary Window (~5 hours)",
        response.rate_limit.primary_window,
      ),
      toUsageWindow(
        "Secondary Window (~7 days)",
        response.rate_limit.secondary_window,
      ),
    ],
    metadata: {
      allowed: response.rate_limit.allowed,
      limitReached: response.rate_limit.limit_reached,
    },
  };
}
