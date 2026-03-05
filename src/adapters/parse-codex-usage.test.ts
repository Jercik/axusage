import { describe, it, expect } from "vitest";
import {
  toUsageWindow,
  toAdditionalWindows,
  toServiceUsageData,
} from "./parse-codex-usage.js";
import type {
  CodexRateLimitWindow,
  CodexAdditionalRateLimit,
  CodexUsageResponse,
} from "../types/codex.js";

const baseRateLimit = {
  allowed: true,
  limit_reached: false,
  primary_window: {
    used_percent: 10,
    limit_window_seconds: 100,
    reset_after_seconds: 50,
    reset_at: 1000,
  },
  secondary_window: {
    used_percent: 20,
    limit_window_seconds: 200,
    reset_after_seconds: 150,
    reset_at: 2000,
  },
} as const;

describe("codex parsing", () => {
  it("converts a rate limit window correctly", () => {
    const win = toUsageWindow("Primary", {
      used_percent: 12,
      limit_window_seconds: 18_000,
      reset_after_seconds: 3600,
      reset_at: 1_761_750_000,
    } satisfies CodexRateLimitWindow);
    expect(win.name).toBe("Primary");
    expect(win.utilization).toBe(12);
    expect(win.periodDurationMs).toBe(18_000 * 1000);
    expect(win.resetsAt.getTime()).toBe(1_761_750_000 * 1000);
  });

  it("maps response to domain model with metadata", () => {
    const resp: CodexUsageResponse = {
      plan_type: "pro",
      rate_limit: baseRateLimit,
      // eslint-disable-next-line unicorn/no-null -- API returns null
      credits: null,
    };

    const data = toServiceUsageData(resp);
    expect(data.service).toBe("ChatGPT");
    expect(data.planType).toBe("pro");
    expect(data.metadata).toEqual({ allowed: true, limitReached: false });
    expect(data.windows).toHaveLength(2);
    expect(data.windows[0]?.name).toContain("Primary");
    expect(data.windows[1]?.name).toContain("Secondary");
  });

  it("includes additional rate limit windows", () => {
    const resp: CodexUsageResponse = {
      plan_type: "pro",
      rate_limit: baseRateLimit,
      // eslint-disable-next-line unicorn/no-null -- API returns null
      credits: null,
      additional_rate_limits: [
        {
          limit_name: "gpt-5.2-codex-sonic",
          metered_feature: "codex_bengalfox",
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: {
              used_percent: 88,
              limit_window_seconds: 1800,
              reset_after_seconds: 600,
              reset_at: 1_735_693_200,
            },
          },
        },
      ],
    };

    const data = toServiceUsageData(resp);
    expect(data.windows).toHaveLength(3);
    expect(data.windows[2]?.name).toBe("gpt-5.2-codex-sonic (primary)");
    expect(data.windows[2]?.utilization).toBe(88);
    expect(data.windows[2]?.periodDurationMs).toBe(1800 * 1000);
  });

  it("handles null additional_rate_limits", () => {
    const resp: CodexUsageResponse = {
      plan_type: "plus",
      rate_limit: baseRateLimit,
      // eslint-disable-next-line unicorn/no-null -- API returns null
      credits: null,
      // eslint-disable-next-line unicorn/no-null -- API returns null
      additional_rate_limits: null,
    };

    const data = toServiceUsageData(resp);
    expect(data.windows).toHaveLength(2);
  });

  it("uses metered_feature as fallback label", () => {
    const limit: CodexAdditionalRateLimit = {
      limit_name: "",
      metered_feature: "codex_other",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 50,
          limit_window_seconds: 3600,
          reset_after_seconds: 1800,
          reset_at: 1_735_693_200,
        },
      },
    };

    const windows = toAdditionalWindows(limit);
    expect(windows).toHaveLength(1);
    expect(windows[0]?.name).toBe("codex_other (primary)");
  });

  it("returns empty windows for null rate_limit in additional entry", () => {
    const limit: CodexAdditionalRateLimit = {
      limit_name: "codex_other",
      metered_feature: "codex_other",
      // eslint-disable-next-line unicorn/no-null -- API returns null
      rate_limit: null,
    };

    const windows = toAdditionalWindows(limit);
    expect(windows).toHaveLength(0);
  });

  it("includes both primary and secondary from additional limits", () => {
    const resp: CodexUsageResponse = {
      plan_type: "pro",
      rate_limit: baseRateLimit,
      // eslint-disable-next-line unicorn/no-null -- API returns null
      credits: null,
      additional_rate_limits: [
        {
          limit_name: "codex_other",
          metered_feature: "codex_other",
          rate_limit: {
            allowed: true,
            limit_reached: false,
            primary_window: {
              used_percent: 30,
              limit_window_seconds: 1800,
              reset_after_seconds: 600,
              reset_at: 1_735_693_200,
            },
            secondary_window: {
              used_percent: 15,
              limit_window_seconds: 604_800,
              reset_after_seconds: 300_000,
              reset_at: 1_736_000_000,
            },
          },
        },
      ],
    };

    const data = toServiceUsageData(resp);
    expect(data.windows).toHaveLength(4);
    expect(data.windows[2]?.name).toBe("codex_other (primary)");
    expect(data.windows[2]?.utilization).toBe(30);
    expect(data.windows[3]?.name).toBe("codex_other (secondary)");
    expect(data.windows[3]?.utilization).toBe(15);
  });
});
