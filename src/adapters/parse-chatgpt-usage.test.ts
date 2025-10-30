import { describe, it, expect } from "vitest";
import { toUsageWindow, toServiceUsageData } from "./parse-chatgpt-usage.js";
import type {
  ChatGPTRateLimitWindow,
  ChatGPTUsageResponse,
} from "../types/chatgpt.js";

describe("chatgpt parsing", () => {
  it("converts a rate limit window correctly", () => {
    const win = toUsageWindow("Primary", {
      used_percent: 12,
      limit_window_seconds: 18000,
      reset_after_seconds: 3600,
      reset_at: 1761750000,
    } satisfies ChatGPTRateLimitWindow);
    expect(win.name).toBe("Primary");
    expect(win.utilization).toBe(12);
    expect(win.periodDurationMs).toBe(18000 * 1000);
    expect(win.resetsAt.getTime()).toBe(1761750000 * 1000);
  });

  it("maps response to domain model with metadata", () => {
    const resp: ChatGPTUsageResponse = {
      plan_type: "pro",
      rate_limit: {
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
      },
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
});
