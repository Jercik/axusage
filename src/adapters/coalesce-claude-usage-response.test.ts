import { describe, it, expect } from "vitest";
import { coalesceClaudeUsageResponse } from "./coalesce-claude-usage-response.js";

describe("coalesceClaudeUsageResponse", () => {
  it("retains required windows even when reset timestamps are missing", () => {
    const result = coalesceClaudeUsageResponse([
      {
        name: "Five Hour Usage",
        utilization: 10,
        // eslint-disable-next-line unicorn/no-null -- API may return null reset timestamps
        resets_at: null,
      },
      {
        name: "Seven Day Usage",
        utilization: 20,
      },
      {
        name: "Seven Day Opus Usage",
        utilization: 30,
        // eslint-disable-next-line unicorn/no-null -- API may return null reset timestamps
        reset_at: null,
      },
    ]);

    expect(result).toBeDefined();
    expect(result?.five_hour.utilization).toBe(10);
    expect(result?.five_hour.resets_at).toBeUndefined();
    expect(result?.seven_day.resets_at).toBeUndefined();
    expect(result?.seven_day_opus.resets_at).toBeUndefined();
  });

  it("derives utilization from alternative percentage fields", () => {
    const result = coalesceClaudeUsageResponse([
      { name: "Five Hour Usage", percent: 25 },
      { name: "Seven Day Usage", percentage: 55 },
      { name: "Seven Day Opus Usage", utilization: 65 },
    ]);

    expect(result?.five_hour.utilization).toBe(25);
    expect(result?.seven_day.utilization).toBe(55);
    expect(result?.seven_day_opus.utilization).toBe(65);
  });
});
