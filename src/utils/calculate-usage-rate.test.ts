import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateUsageRate } from "./calculate-usage-rate.js";

describe("calculate-usage-rate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0 when elapsed is zero or negative", () => {
    // Construct a future reset and long period so periodStart is in the future
    const now = new Date("2025-01-01T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const resetAt = new Date("2025-01-05T00:00:00Z");
    const periodMs = 3 * 24 * 60 * 60 * 1000; // 3 days -> periodStart = Jan 2
    // now (Jan 1) is before periodStart (Jan 2) => elapsedPercentage <= 0
    const rate = calculateUsageRate(50, resetAt, periodMs);
    expect(rate).toBe(0);
  });

  it("computes rate as utilization / elapsed%", () => {
    // Period: 100 minutes; now at 50 minutes from start => elapsed% = 50
    const periodMs = 100 * 60 * 1000;
    const periodStart = new Date("2025-01-01T00:00:00Z").getTime();
    const now = periodStart + 50 * 60 * 1000;
    const resetsAt = new Date(periodStart + periodMs);
    vi.spyOn(Date, "now").mockReturnValue(now);

    const rate = calculateUsageRate(25, new Date(resetsAt), periodMs);
    // utilization 25 / elapsed% 50 = 0.5
    expect(rate).toBeCloseTo(0.5, 5);
  });
});
