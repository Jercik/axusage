import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateUsageRate } from "./calculate-usage-rate.js";

describe("calculate-usage-rate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when elapsed is zero or negative", () => {
    // Construct a future reset and long period so periodStart is in the future
    const now = new Date("2025-01-01T00:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(now);

    const resetAt = new Date("2025-01-05T00:00:00Z");
    const periodMs = 3 * 24 * 60 * 60 * 1000; // 3 days -> periodStart = Jan 2
    // now (Jan 1) is before periodStart (Jan 2) => elapsedPercentage <= 0
    const rate = calculateUsageRate(50, resetAt, periodMs);
    expect(rate).toBeUndefined();
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

  it("returns undefined when reset timestamp is missing", () => {
    const rate = calculateUsageRate(25, undefined, 1000);
    expect(rate).toBeUndefined();
  });

  describe("minimum elapsed time threshold", () => {
    it("returns undefined when less than 5% AND less than 2h elapsed", () => {
      // Period: 24 hours, elapsed: 1 hour (4.17% < 5%, and 1h < 2h)
      const periodMs = 24 * 60 * 60 * 1000;
      const periodStart = new Date("2025-01-01T00:00:00Z").getTime();
      const now = periodStart + 1 * 60 * 60 * 1000; // 1 hour elapsed
      const resetsAt = new Date(periodStart + periodMs);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const rate = calculateUsageRate(10, resetsAt, periodMs);
      expect(rate).toBeUndefined();
    });

    it("returns rate when >= 5% elapsed (even if < 2h)", () => {
      // Period: 20 hours, elapsed: 1 hour (5% of 20h, which is < 2h)
      const periodMs = 20 * 60 * 60 * 1000;
      const periodStart = new Date("2025-01-01T00:00:00Z").getTime();
      const now = periodStart + 1 * 60 * 60 * 1000; // 1 hour = 5%
      const resetsAt = new Date(periodStart + periodMs);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const rate = calculateUsageRate(10, resetsAt, periodMs);
      // utilization 10 / elapsed% 5 = 2
      expect(rate).toBeCloseTo(2, 5);
    });

    it("returns rate when >= 2h elapsed (even if < 5%)", () => {
      // Period: 1 week, elapsed: 2 hours (1.19% < 5%, but 2h threshold met)
      const periodMs = 7 * 24 * 60 * 60 * 1000;
      const periodStart = new Date("2025-01-01T00:00:00Z").getTime();
      const now = periodStart + 2 * 60 * 60 * 1000; // 2 hours elapsed
      const resetsAt = new Date(periodStart + periodMs);
      vi.spyOn(Date, "now").mockReturnValue(now);

      const rate = calculateUsageRate(5, resetsAt, periodMs);
      // elapsed% = (2h / 168h) * 100 = 1.19%
      // utilization 5 / elapsed% 1.19 ≈ 4.2
      const elapsedPercent = (2 / 168) * 100;
      expect(rate).toBeCloseTo(5 / elapsedPercent, 2);
    });

    it("uses 5% threshold for short periods (where 5% < 2h)", () => {
      // Period: 10 hours, 5% = 30 min (< 2h), so 5% threshold applies
      const periodMs = 10 * 60 * 60 * 1000;
      const periodStart = new Date("2025-01-01T00:00:00Z").getTime();

      // At 29 minutes (just under 5%) - should return undefined
      const now29min = periodStart + 29 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now29min);
      expect(
        calculateUsageRate(10, new Date(periodStart + periodMs), periodMs),
      ).toBeUndefined();

      // At exactly 30 minutes (exactly 5%) - should return rate (uses < not <=)
      const now30min = periodStart + 30 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now30min);
      expect(
        calculateUsageRate(10, new Date(periodStart + periodMs), periodMs),
      ).toBeDefined();

      // At 31 minutes (just over 5%) - should return rate
      const now31min = periodStart + 31 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now31min);
      const rate = calculateUsageRate(
        10,
        new Date(periodStart + periodMs),
        periodMs,
      );
      expect(rate).toBeDefined();
    });

    it("uses 2h threshold for long periods (where 5% > 2h)", () => {
      // Period: 100 hours, 5% = 5h (> 2h), so 2h threshold applies
      const periodMs = 100 * 60 * 60 * 1000;
      const periodStart = new Date("2025-01-01T00:00:00Z").getTime();

      // At 1h59min (just under 2h) - should return undefined
      const now119min = periodStart + 119 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now119min);
      expect(
        calculateUsageRate(10, new Date(periodStart + periodMs), periodMs),
      ).toBeUndefined();

      // At exactly 2h (120 min) - should return rate (uses < not <=)
      const now120min = periodStart + 120 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now120min);
      expect(
        calculateUsageRate(10, new Date(periodStart + periodMs), periodMs),
      ).toBeDefined();

      // At 2h1min (just over 2h) - should return rate
      const now121min = periodStart + 121 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(now121min);
      const rate = calculateUsageRate(
        10,
        new Date(periodStart + periodMs),
        periodMs,
      );
      expect(rate).toBeDefined();
    });
  });
});
