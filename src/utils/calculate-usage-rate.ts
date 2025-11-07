/**
 * Calculates usage rate based on time elapsed vs usage consumed
 * Rate = actual_usage / expected_usage
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
  const elapsedPercentage = (elapsedTime / periodDurationMs) * 100;
  if (elapsedPercentage <= 0) return 0;
  return utilization / elapsedPercentage;
}
