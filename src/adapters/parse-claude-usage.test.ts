import { describe, it, expect } from "vitest";
import {
  toServiceUsageData,
  CLAUDE_PERIOD_DURATIONS,
} from "./parse-claude-usage.js";
import {
  UsageResponse as UsageResponseSchema,
  type UsageResponse,
  type UsageResponseInput,
} from "../types/usage.js";

describe("claude parsing", () => {
  it("excludes oauth apps window when null and uses correct durations", () => {
    const resp: UsageResponse = {
      five_hour: { utilization: 1, resets_at: "2025-10-29T00:00:00Z" },
      seven_day: { utilization: 2, resets_at: "2025-10-30T00:00:00Z" },
      // eslint-disable-next-line unicorn/no-null -- API returns null
      seven_day_oauth_apps: null,
      seven_day_opus: { utilization: 3, resets_at: "2025-11-01T00:00:00Z" },
    };

    const data = toServiceUsageData(resp);
    expect(data.service).toBe("Claude");
    expect(data.windows).toHaveLength(3);
    expect(data.windows[0]?.periodDurationMs).toBe(
      CLAUDE_PERIOD_DURATIONS.five_hour,
    );
    expect(data.windows[1]?.periodDurationMs).toBe(
      CLAUDE_PERIOD_DURATIONS.seven_day,
    );
    expect(data.windows[2]?.periodDurationMs).toBe(
      CLAUDE_PERIOD_DURATIONS.seven_day_opus,
    );
  });

  it("includes oauth apps window when provided", () => {
    const resp: UsageResponse = {
      five_hour: { utilization: 1, resets_at: "2025-10-29T00:00:00Z" },
      seven_day: { utilization: 2, resets_at: "2025-10-30T00:00:00Z" },
      seven_day_oauth_apps: {
        utilization: 5,
        resets_at: "2025-10-31T00:00:00Z",
      },
      seven_day_opus: { utilization: 3, resets_at: "2025-11-01T00:00:00Z" },
    };

    const data = toServiceUsageData(resp);
    expect(data.windows).toHaveLength(4);
    expect(data.windows[2]?.name).toBe("7-Day OAuth Apps");
  });

  it("handles missing reset timestamp by propagating undefined", () => {
    const resp: UsageResponseInput = {
      five_hour: {
        utilization: 0,
        // eslint-disable-next-line unicorn/no-null -- API returns null
        resets_at: null, // API null is transformed to undefined by the schema
      },
      seven_day: { utilization: 2, resets_at: "2025-10-30T00:00:00Z" },
      // eslint-disable-next-line unicorn/no-null -- API returns null
      seven_day_oauth_apps: null,
      seven_day_opus: { utilization: 3, resets_at: "2025-11-01T00:00:00Z" },
    };

    const data = toServiceUsageData(UsageResponseSchema.parse(resp));
    expect(data.windows[0]?.resetsAt).toBeUndefined();
  });

  it("keeps windows when every reset timestamp is missing", () => {
    const resp: UsageResponse = {
      five_hour: {
        utilization: 1,
        resets_at: undefined,
      },
      seven_day: {
        utilization: 2,
        resets_at: undefined,
      },
      seven_day_oauth_apps: {
        utilization: 3,
        resets_at: undefined,
      },
      seven_day_opus: {
        utilization: 4,
        resets_at: undefined,
      },
    };

    const data = toServiceUsageData(resp);
    expect(data.windows).toHaveLength(4);
    for (const window of data.windows) {
      expect(window.resetsAt).toBeUndefined();
    }
  });
});
