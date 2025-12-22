import { readFile, writeFile, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { Result } from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import type { GeminiCredentials } from "../types/gemini.js";
import { GeminiTokenRefreshResponse } from "../types/gemini.js";
import { getCredentialsPath } from "./gemini-credentials.js";

const TOKEN_REFRESH_URL = "https://oauth2.googleapis.com/token";

/**
 * Paths to search for OAuth config relative to gemini binary.
 *
 * FRAGILE: These paths depend on the internal directory structure of the
 * @google/gemini-cli package, which may change in future versions. If the
 * CLI updates and breaks this, users should report the issue.
 *
 * NOTE: On Windows, global npm binaries (gemini.cmd) behave differently.
 * The realpath resolution may not work as expected on Windows. This is a
 * known limitation of CLI-based auth integration.
 */
const OAUTH_CONFIG_PATHS = [
  // Homebrew nested structure
  "../libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
  // Homebrew lib structure
  "../lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
  // Bun/npm sibling installation
  "../../gemini-cli-core/dist/src/code_assist/oauth2.js",
  // npm local node_modules
  "../node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js",
];

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
};

/**
 * Find the gemini binary path using platform-appropriate command.
 * Uses 'where' on Windows, 'which' on Unix-like systems.
 */
function findGeminiBinary(): string | undefined {
  try {
    const isWindows = process.platform === "win32";
    const command = isWindows ? "where" : "which";
    const result = execFileSync(command, ["gemini"], {
      encoding: "utf8",
      timeout: 5000,
    });
    // Handle potential multiple lines (Windows 'where' can return multiple paths)
    return result.split(/\r?\n/u)[0]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract OAuth client credentials from Gemini CLI's oauth2.js file
 */
async function extractOAuthConfig(): Promise<Result<OAuthConfig, ApiError>> {
  const binaryPath = findGeminiBinary();
  if (!binaryPath) {
    return {
      ok: false,
      error: new ApiError(
        "Gemini CLI not found. Install it with: npm install -g @google/gemini-cli",
      ),
    };
  }

  // Resolve symlinks to find actual installation directory
  let realBinaryPath: string;
  try {
    realBinaryPath = await realpath(binaryPath);
  } catch {
    realBinaryPath = binaryPath;
  }

  const binaryDirectory = path.dirname(realBinaryPath);

  // Search for oauth2.js in known locations
  for (const relativePath of OAUTH_CONFIG_PATHS) {
    const oauth2Path = path.join(binaryDirectory, relativePath);
    if (existsSync(oauth2Path)) {
      try {
        const content = await readFile(oauth2Path, "utf8");

        // FRAGILE: Extract client ID and secret using regex.
        // This parsing will break if the Gemini CLI changes how constants are
        // declared (e.g., template literals, different spacing, exports).
        // If this breaks after a Gemini CLI update, please report the issue.
        const clientIdMatch = /OAUTH_CLIENT_ID\s*=\s*['"]([^'"]+)['"]/u.exec(
          content,
        );
        const clientSecretMatch =
          /OAUTH_CLIENT_SECRET\s*=\s*['"]([^'"]+)['"]/u.exec(content);

        if (clientIdMatch?.[1] && clientSecretMatch?.[1]) {
          return {
            ok: true,
            value: {
              clientId: clientIdMatch[1],
              clientSecret: clientSecretMatch[1],
            },
          };
        }
      } catch {
        // Try next path
        continue;
      }
    }
  }

  return {
    ok: false,
    error: new ApiError(
      "Could not find Gemini CLI OAuth configuration. Ensure Gemini CLI is properly installed.",
    ),
  };
}

/**
 * Refresh the OAuth access token using the refresh token
 */
export async function refreshGeminiToken(
  credentials: GeminiCredentials,
): Promise<Result<GeminiCredentials, ApiError>> {
  const configResult = await extractOAuthConfig();
  if (!configResult.ok) {
    return configResult;
  }

  const { clientId, clientSecret } = configResult.value;

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    });

    const response = await fetch(TOKEN_REFRESH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: new ApiError(
          `Token refresh failed: ${String(response.status)} ${errorText}`,
          response.status,
        ),
      };
    }

    const data: unknown = await response.json();
    const parseResult = GeminiTokenRefreshResponse.safeParse(data);

    if (!parseResult.success) {
      return {
        ok: false,
        error: new ApiError(
          `Invalid token refresh response: ${parseResult.error.message}`,
        ),
      };
    }

    const refreshData = parseResult.data;

    // Create updated credentials
    const updatedCredentials: GeminiCredentials = {
      access_token: refreshData.access_token,
      refresh_token: credentials.refresh_token, // Keep original refresh token
      id_token: refreshData.id_token ?? credentials.id_token,
      expiry_date: Date.now() + refreshData.expires_in * 1000,
    };

    // Write updated credentials to file
    try {
      await writeFile(
        getCredentialsPath(),
        JSON.stringify(updatedCredentials, undefined, 2),
        { mode: 0o600 },
      );
    } catch (writeError) {
      // Log but don't fail - token is still valid even if we can't save it
      console.error(
        `Warning: Could not save refreshed credentials: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
      );
    }

    return { ok: true, value: updatedCredentials };
  } catch (error) {
    return {
      ok: false,
      error: new ApiError(
        `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}
