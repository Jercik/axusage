/**
 * Unified credential fetcher for services.
 *
 * Fetches access tokens based on per-service configuration:
 * - "local": From local axauth credential store
 * - "vault": From axvault server
 * - "auto": Try vault first if configured, fallback to local
 */

import {
  fetchVaultCredentials,
  getAgentAccessToken,
  isVaultConfigured,
} from "axauth";
import type { AgentCli } from "axauth";

import type { SupportedService } from "./supported-service.js";
import { getServiceSourceConfig } from "../config/credential-sources.js";
import { getCopilotTokenFromCustomGhPath } from "../utils/copilot-gh-token.js";

/**
 * Extract access token from vault credentials.
 *
 * Different credential types store tokens differently:
 * - oauth-credentials: access_token (Gemini style) or tokens.access_token (Codex/OpenAI style)
 * - oauth-token: accessToken field (Claude style)
 * - api-key: apiKey field
 */
function extractAccessToken(
  credentials: { type: string; data: Record<string, unknown> } | undefined,
): string | undefined {
  if (!credentials) return undefined;

  const { data } = credentials;

  // Try accessToken first (Claude oauth-token style, camelCase)
  if (typeof data.accessToken === "string") {
    return data.accessToken;
  }

  // Try access_token at top level (Gemini oauth-credentials style, snake_case)
  if (typeof data.access_token === "string") {
    return data.access_token;
  }

  // Try tokens.access_token (Codex/OpenAI oauth-credentials style)
  if (
    data.tokens &&
    typeof data.tokens === "object" &&
    "access_token" in data.tokens &&
    typeof data.tokens.access_token === "string"
  ) {
    return data.tokens.access_token;
  }

  // Try apiKey as fallback (api-key type)
  if (typeof data.apiKey === "string") {
    return data.apiKey;
  }

  return undefined;
}

/**
 * Fetch access token from vault.
 *
 * @returns Access token string or undefined if not available
 */
async function fetchFromVault(
  agentId: AgentCli,
  credentialName: string,
): Promise<string | undefined> {
  try {
    const result = await fetchVaultCredentials({
      agentId,
      name: credentialName,
    });

    if (!result.ok) {
      // Log warning for debugging, but don't fail hard
      if (result.reason !== "not-configured" && result.reason !== "not-found") {
        console.error(
          `[axusage] Vault fetch failed for ${agentId}/${credentialName}: ${result.reason}`,
        );
      }
      return undefined;
    }

    const token = extractAccessToken(result.credentials);
    if (!token) {
      console.error(
        `[axusage] Vault credentials for ${agentId}/${credentialName} missing access token. ` +
          `Credential type: ${result.credentials.type}`,
      );
    }
    return token;
  } catch (error) {
    console.error(
      `[axusage] Vault fetch error for ${agentId}/${credentialName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

/**
 * Fetch access token from local credential store.
 *
 * @returns Access token string or undefined if not available
 */
async function fetchFromLocal(agentId: AgentCli): Promise<string | undefined> {
  try {
    const token = await getAgentAccessToken(agentId);
    if (token) return token;
  } catch (error) {
    console.error(
      `[axusage] Local credential fetch error for ${agentId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (agentId === "copilot") {
    return getCopilotTokenFromCustomGhPath();
  }

  return undefined;
}

/**
 * Get access token for a service.
 *
 * Uses the configured credential source for the service:
 * - "local": Fetch from local axauth credential store
 * - "vault": Fetch from axvault server (requires credential name)
 * - "auto": Try vault if configured and name provided, fallback to local
 *
 * @param service - Service ID (e.g., "claude", "codex", "gemini")
 * @returns Access token string or undefined if not available
 *
 * @example
 * const token = await getServiceAccessToken("claude");
 * if (!token) {
 *   console.error("No credentials found for Claude");
 * }
 */
async function getServiceAccessToken(
  service: SupportedService,
): Promise<string | undefined> {
  const config = getServiceSourceConfig(service);
  const agentId: AgentCli = service;

  switch (config.source) {
    case "local": {
      return fetchFromLocal(agentId);
    }

    case "vault": {
      if (!config.name) {
        console.error(
          `[axusage] Vault source requires credential name for ${service}. ` +
            `Set {"${service}": {"source": "vault", "name": "your-name"}} in config.`,
        );
        return undefined;
      }
      const token = await fetchFromVault(agentId, config.name);
      if (!token) {
        // User explicitly selected vault but it failed - provide clear feedback
        console.error(
          `[axusage] Vault credential fetch failed for ${service}. ` +
            `Check that vault is configured (AXVAULT env) and credential "${config.name}" exists.`,
        );
      }
      return token;
    }

    case "auto": {
      // Auto mode: try vault first if configured and name provided
      if (config.name && isVaultConfigured()) {
        const vaultToken = await fetchFromVault(agentId, config.name);
        if (vaultToken) {
          return vaultToken;
        }
        // Fallback to local if vault failed
      }
      // No credential name or vault not configured: use local only
      return fetchFromLocal(agentId);
    }
  }
}

export { getServiceAccessToken };
