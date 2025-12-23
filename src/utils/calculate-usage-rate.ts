/** Minimum fraction of period that must elapse before showing rate */
const MIN_ELAPSED_FRACTION = 0.05; // 5%

/** Minimum time that must elapse before showing rate (2 hours in ms) */
const MIN_ELAPSED_TIME_MS = 2 * 60 * 60 * 1000;

/**
 * Calculates usage rate based on time elapsed vs usage consumed
 * Rate = actual_usage / expected_usage
 *
 * Returns undefined if insufficient time has elapsed for accurate rate calculation.
 * Rate is shown after either {@link MIN_ELAPSED_FRACTION} of the period OR
 * {@link MIN_ELAPSED_TIME_MS} has passed (whichever comes first).
 */
export function calculateUsageRate(
  utilization: number,
  resetsAt: Date | undefined,
  periodDurationMs: number,
): number | undefined {
  if (!resetsAt) return undefined;
  if (periodDurationMs <= 0) return 0;
  const now = Date.now();
  const resetTime = resetsAt.getTime();
  const periodStart = resetTime - periodDurationMs;

  const elapsedTime = now - periodStart;
  if (elapsedTime <= 0) return 0;

  // Avoid inaccurate rates early in the period
  // Show rate after 5% of period OR 2 hours elapsed (whichever first)
  const minElapsedTime = Math.min(
    periodDurationMs * MIN_ELAPSED_FRACTION,
    MIN_ELAPSED_TIME_MS,
  );
  if (elapsedTime < minElapsedTime) return undefined;

  const elapsedPercentage = (elapsedTime / periodDurationMs) * 100;
  return utilization / elapsedPercentage;
}
