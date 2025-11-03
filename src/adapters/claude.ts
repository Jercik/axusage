import type {
  ServiceAdapter,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { UsageResponse as UsageResponseSchema } from "../types/usage.js";
import { z } from "zod";
import { toServiceUsageData } from "./parse-claude-usage.js";
import { BrowserAuthManager } from "../services/browser-auth-manager.js";

const API_URL = "https://api.anthropic.com/api/oauth/usage";

/** Functional core is extracted to ./parse-claude-usage.ts */

/**
 * Claude service adapter
 */
export const claudeAdapter: ServiceAdapter = {
  name: "Claude",

  async fetchUsage(): Promise<Result<ServiceUsageData, ApiError>> {
    const manager = new BrowserAuthManager();
    try {
      const body = await manager.makeAuthenticatedRequest("claude", API_URL);
      const data = JSON.parse(body);
      let parseResult = UsageResponseSchema.safeParse(data);

      if (!parseResult.success) {
        // Heuristic: some Claude endpoints return an array of windows
        if (Array.isArray(data)) {
          const Item = z.object({
            window: z.string().optional(),
            period: z.string().optional(),
            name: z.string().optional(),
            key: z.string().optional(),
            utilization: z.number().optional(),
            percentage: z.number().optional(),
            percent: z.number().optional(),
            resets_at: z.string().optional(),
            reset_at: z.string().optional(),
            resetsAt: z.string().optional(),
            resetAt: z.string().optional(),
          });
          const arrayParse = z.array(Item).safeParse(data);
          if (arrayParse.success) {
            const items = arrayParse.data;
            const keyOf = (it: z.infer<typeof Item>) =>
              (it.window || it.period || it.name || it.key || "").toLowerCase();
            const metricOf = (it: Partial<z.infer<typeof Item>>) => ({
              utilization: it.utilization ?? it.percentage ?? it.percent ?? 0,
              resets_at:
                it.resets_at ??
                it.reset_at ??
                it.resetsAt ??
                it.resetAt ??
                new Date().toISOString(),
            });
            const pick = (...match: string[]) => {
              const found = items.find((it: z.infer<typeof Item>) =>
                match.some((m) => keyOf(it).includes(m)),
              );
              return found ? metricOf(found) : undefined;
            };
            const coalesced = {
              five_hour:
                pick("five", "5-hour", "5hour") ?? metricOf(items[0] ?? {}),
              seven_day:
                pick("7", "seven_day", "7-day", "week") ??
                metricOf(items[1] ?? items[0] ?? {}),
              seven_day_oauth_apps: pick("oauth") ?? undefined,
              seven_day_opus:
                pick("opus") ?? metricOf(items[2] ?? items[0] ?? {}),
            } as const;
            parseResult = UsageResponseSchema.safeParse(coalesced);
          }
        }
        if (!parseResult.success) {
          return {
            ok: false,
            error: new ApiError(
              `Invalid response format: ${parseResult.error.message}`,
              undefined,
              data,
            ),
          };
        }
      }

      return {
        ok: true,
        value: toServiceUsageData(parseResult.data),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const hint = message.includes("401")
        ? "Claude usage is not exposed via Console session. The only documented programmatic access is the Admin Usage API, which requires an Admin API key."
        : undefined;
      return {
        ok: false,
        error: new ApiError(
          hint
            ? `${message}. ${hint}`
            : `Browser authentication failed: ${message}`,
        ),
      };
    } finally {
      await manager.close();
    }
  },
};
