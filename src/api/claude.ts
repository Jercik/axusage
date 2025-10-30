import type { UsageResponse } from "#types/usage";
import { UsageResponse as UsageResponseSchema } from "#types/usage";

type Result<T, E extends Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export class ClaudeApiError extends Error {
  readonly status?: number;
  readonly body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Configuration for the Claude API client
 */
export type ClaudeClientConfig = {
  readonly accessToken: string;
  readonly baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const BETA_VERSION = "oauth-2025-04-20";

/**
 * Fetches usage statistics from the Claude API
 */
export async function fetchUsage(
  config: ClaudeClientConfig,
): Promise<Result<UsageResponse, ClaudeApiError>> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/oauth/usage`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "anthropic-beta": BETA_VERSION,
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "Unable to read response");
      return {
        ok: false,
        error: new ClaudeApiError(
          `API request failed: ${String(response.status)} ${response.statusText}`,
          response.status,
          body,
        ),
      };
    }

    const data = await response.json();
    const parseResult = UsageResponseSchema.safeParse(data);

    if (!parseResult.success) {
      return {
        ok: false,
        error: new ClaudeApiError(
          `Invalid response format: ${parseResult.error.message}`,
          response.status,
          data,
        ),
      };
    }

    return {
      ok: true,
      value: parseResult.data,
    };
  } catch (error) {
    return {
      ok: false,
      error: new ClaudeApiError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}
