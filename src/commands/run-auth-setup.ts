import type { ApiError, Result, ServiceUsageData } from "../types/domain.js";

/**
 * Check if an error message indicates an authentication issue.
 * Matches common authentication error patterns like "unauthorized", "401",
 * "authentication failed", etc. with word boundaries to avoid false positives.
 *
 * @param message - The error message to check
 * @returns true if the message indicates an authentication error
 *
 * @example
 * isAuthError("401 Unauthorized") // true
 * isAuthError("Network timeout") // false
 */
export function isAuthError(message: string): boolean {
  const authPatterns = [
    /\bauthentication\s+failed\b/iu,
    /\bno\s+saved\s+authentication\b/iu,
    /\b401\b/u,
    /\bunauthorized\b/iu,
    /\bsession\s+expired\b/iu,
    /\blogin\s+required\b/iu,
    /\bcredentials?\s+(expired|invalid)\b/iu,
  ];
  return authPatterns.some((pattern) => pattern.test(message));
}

/**
 * Check if a fetch result indicates an authentication failure.
 * Combines the result error check with auth error pattern matching.
 */
export function isAuthFailure(
  result: Result<ServiceUsageData, ApiError>,
): boolean {
  if (result.ok) return false;
  if (result.error.status === 401) return true;
  return Boolean(result.error.message) && isAuthError(result.error.message);
}
