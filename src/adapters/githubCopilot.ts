import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type { GitHubCopilotUsageResponse } from "../types/githubCopilot.js";
import { GitHubCopilotUsageResponse as GitHubCopilotUsageResponseSchema } from "../types/githubCopilot.js";

const API_URL = "https://github.com/github-copilot/chat/entitlement";

/**
 * Calculates the reset date as a Date object
 * GitHub returns date in "YYYY-MM-DD" format
 */
function parseResetDate(resetDateString: string): Date {
  const parts = resetDateString.split("-");

  if (parts.length !== 3) {
    throw new Error(`Invalid reset date format: ${resetDateString}`);
  }

  const [yearString, monthString, dayString] = parts;

  if (!yearString || !monthString || !dayString) {
    throw new Error(`Invalid reset date components: ${resetDateString}`);
  }

  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid reset date components: ${resetDateString}`);
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Calculates the period duration using the provided reset date
 */
function calculatePeriodDuration(resetDate: Date): number {
  const periodEnd = resetDate.getTime();
  const periodStart = new Date(
    Date.UTC(
      resetDate.getUTCFullYear(),
      resetDate.getUTCMonth() - 1,
      resetDate.getUTCDate(),
      0,
      0,
      0,
    ),
  ).getTime();

  return Math.max(periodEnd - periodStart, 0);
}

/**
 * Converts GitHub Copilot response to common domain model
 */
function toServiceUsageData(
  response: GitHubCopilotUsageResponse,
): ServiceUsageData {
  const resetDate = parseResetDate(response.quotas.resetDate);
  const periodDurationMs = calculatePeriodDuration(resetDate);

  // Calculate utilization percentage (how much has been used)
  const used =
    response.quotas.limits.premiumInteractions -
    response.quotas.remaining.premiumInteractions;
  const utilization = (used / response.quotas.limits.premiumInteractions) * 100;

  return {
    service: "GitHub Copilot",
    planType: response.plan,
    windows: [
      {
        name: "Monthly Premium Interactions",
        utilization: Math.round(utilization * 100) / 100, // Round to 2 decimal places
        resetsAt: resetDate,
        periodDurationMs,
      },
    ],
    // Note: metadata is optional and has a specific structure in the domain type
    // We could extend the domain type if we need to store more Copilot-specific data
  };
}

/**
 * GitHub Copilot service adapter
 *
 * Note: This adapter uses GitHub session cookies for authentication
 * instead of Bearer tokens like other services.
 */
export const githubCopilotAdapter: ServiceAdapter = {
  name: "GitHub Copilot",

  async fetchUsage(
    config: ServiceConfig,
  ): Promise<Result<ServiceUsageData, ApiError>> {
    try {
      // The access token for Copilot is actually a session cookie value
      // Decode if URL-encoded (e.g., %2F -> /)
      const sessionToken = decodeURIComponent(config.accessToken);

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-requested-with": "XMLHttpRequest",
          "github-verified-fetch": "true",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
          cookie: `user_session=${sessionToken}`,
        },
      });

      if (!response.ok) {
        const body = await response
          .text()
          .catch(() => "Unable to read response");

        // Special handling for common GitHub errors
        if (response.status === 401 || response.status === 403) {
          return {
            ok: false,
            error: new ApiError(
              `Authentication failed. Please ensure your GitHub session token is valid.`,
              response.status,
              body,
            ),
          };
        }

        return {
          ok: false,
          error: new ApiError(
            `API request failed: ${String(response.status)} ${response.statusText}`,
            response.status,
            body,
          ),
        };
      }

      const data = await response.json();
      const parseResult = GitHubCopilotUsageResponseSchema.safeParse(data);

      if (!parseResult.success) {
        return {
          ok: false,
          error: new ApiError(
            `Invalid response format: ${parseResult.error.message}`,
            response.status,
            data,
          ),
        };
      }

      try {
        return {
          ok: true,
          value: toServiceUsageData(parseResult.data),
        };
      } catch (error) {
        return {
          ok: false,
          error: new ApiError(
            error instanceof Error
              ? error.message
              : "Unable to parse GitHub Copilot reset date",
            response.status,
            parseResult.data.quotas.resetDate,
          ),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: new ApiError(
          `Network error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  },
};
