/**
 * Instance-aware credential fetcher.
 *
 * Resolves an access token for a specific service instance config,
 * returning vault metadata (displayName) alongside the token.
 */

import {
  fetchVaultCredentials,
  getAgentAccessToken,
  isVaultConfigured,
} from "axauth";
import type { AgentCli } from "axauth";

import type { ResolvedInstanceConfig } from "../config/credential-sources.js";
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

/** Result of resolving an instance token */
interface InstanceTokenResult {
  token: string | undefined;
  vaultDisplayName: string | undefined;
}

/** Fetch access token from vault, returning metadata alongside the token */
async function fetchFromVaultWithMetadata(
  agentId: AgentCli,
  credentialName: string,
): Promise<InstanceTokenResult> {
  try {
    const result = await fetchVaultCredentials({
      agentId,
      name: credentialName,
    });

    if (!result.ok) {
      if (result.reason !== "not-configured" && result.reason !== "not-found") {
        console.error(
          `[axusage] Vault fetch failed for ${agentId}/${credentialName}: ${result.reason}`,
        );
      }
      return { token: undefined, vaultDisplayName: undefined };
    }

    const token = extractAccessToken(result.credentials);
    if (!token) {
      console.error(
        `[axusage] Vault credentials for ${agentId}/${credentialName} missing access token. ` +
          `Credential type: ${result.credentials.type}`,
      );
    }
    return { token, vaultDisplayName: result.displayName };
  } catch (error) {
    console.error(
      `[axusage] Vault fetch error for ${agentId}/${credentialName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { token: undefined, vaultDisplayName: undefined };
  }
}

/** Fetch access token from local credential store */
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
 * Get access token for a specific service instance.
 *
 * Returns vault metadata (displayName) alongside the token
 * for multi-instance identification.
 */
async function getInstanceAccessToken(
  service: string,
  config: ResolvedInstanceConfig,
): Promise<InstanceTokenResult> {
  const agentId = service as AgentCli;

  switch (config.source) {
    case "local": {
      const token = await fetchFromLocal(agentId);
      return { token, vaultDisplayName: undefined };
    }

    case "vault": {
      if (!config.name) {
        console.error(
          `[axusage] Vault source requires credential name for ${service}. ` +
            `Set {"${service}": {"source": "vault", "name": "your-name"}} in config.`,
        );
        return { token: undefined, vaultDisplayName: undefined };
      }
      const result = await fetchFromVaultWithMetadata(agentId, config.name);
      if (!result.token) {
        console.error(
          `[axusage] Vault credential fetch failed for ${service}. ` +
            `Check that vault is configured (AXVAULT env) and credential "${config.name}" exists.`,
        );
      }
      return result;
    }

    case "auto": {
      if (config.name) {
        // Named credential: vault-only to avoid silently returning
        // the same local token for multiple instances
        if (!isVaultConfigured()) {
          console.error(
            `[axusage] Named credential "${config.name}" for ${service} requires vault, ` +
              `but vault is not configured. Set AXVAULT env or use source "local" instead.`,
          );
          return { token: undefined, vaultDisplayName: undefined };
        }
        return fetchFromVaultWithMetadata(agentId, config.name);
      }
      // No credential name: use local
      const token = await fetchFromLocal(agentId);
      return { token, vaultDisplayName: undefined };
    }
  }
}

export { getInstanceAccessToken };
