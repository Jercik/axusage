import type {
  ServiceAdapter,
  ServiceConfig,
  ServiceUsageData,
  Result,
} from "#types/domain";
import { ApiError } from "#types/domain";
import type { GitHubCopilotUsageResponse } from "#types/githubCopilot";
import { GitHubCopilotUsageResponse as GitHubCopilotUsageResponseSchema } from "#types/githubCopilot";

const API_URL = "https://github.com/github-copilot/chat/entitlement";

/**
 * Calculates the reset date as a Date object
 * GitHub returns date in "YYYY-MM-DD" format
 */
function parseResetDate(resetDateString: string): Date {
  // Parse as UTC midnight on the reset date
  const parts = resetDateString.split("-").map(Number);
  const year = parts[0] ?? 2025;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Calculates the period duration (assumes monthly billing cycle)
 */
function calculatePeriodDuration(): number {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return firstOfNextMonth.getTime() - firstOfMonth.getTime();
}

/**
 * Converts GitHub Copilot response to common domain model
 */
function toServiceUsageData(
  response: GitHubCopilotUsageResponse,
): ServiceUsageData {
  const resetDate = parseResetDate(response.quotas.resetDate);
  const periodDurationMs = calculatePeriodDuration();

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
          "user-agent": "Mozilla/5.0 (compatible; AgentUsageCLI/1.0)",
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

      return {
        ok: true,
        value: toServiceUsageData(parseResult.data),
      };
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
