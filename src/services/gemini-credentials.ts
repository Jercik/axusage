import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Result } from "../types/domain.js";
import { ApiError } from "../types/domain.js";
import { GeminiCredentials, GeminiSettings } from "../types/gemini.js";

const GEMINI_CONFIG_DIR = path.join(homedir(), ".gemini");
const CREDENTIALS_FILE = "oauth_creds.json";
const SETTINGS_FILE = "settings.json";

/**
 * Get the path to the Gemini credentials file
 */
export function getCredentialsPath(): string {
  return path.join(GEMINI_CONFIG_DIR, CREDENTIALS_FILE);
}

/**
 * Get the path to the Gemini settings file
 */
function getSettingsPath(): string {
  return path.join(GEMINI_CONFIG_DIR, SETTINGS_FILE);
}

/**
 * Check if Gemini credentials exist
 */
export function hasGeminiCredentials(): boolean {
  return existsSync(getCredentialsPath());
}

/**
 * Read and parse Gemini credentials from ~/.gemini/oauth_creds.json
 */
export async function readGeminiCredentials(): Promise<
  Result<GeminiCredentials, ApiError>
> {
  const credentialsPath = getCredentialsPath();

  if (!existsSync(credentialsPath)) {
    return {
      ok: false,
      error: new ApiError(
        "Not logged in to Gemini. Run 'gemini' in Terminal to authenticate.",
      ),
    };
  }

  try {
    const content = await readFile(credentialsPath, "utf8");
    const data: unknown = JSON.parse(content);
    const parseResult = GeminiCredentials.safeParse(data);

    if (!parseResult.success) {
      return {
        ok: false,
        error: new ApiError(
          `Invalid Gemini credentials file: ${parseResult.error.message}`,
        ),
      };
    }

    return { ok: true, value: parseResult.data };
  } catch (error) {
    return {
      ok: false,
      error: new ApiError(
        `Failed to read Gemini credentials: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

/**
 * Read Gemini settings to check auth type
 */
export async function readGeminiSettings(): Promise<
  Result<GeminiSettings, ApiError>
> {
  const settingsPath = getSettingsPath();

  if (!existsSync(settingsPath)) {
    // Settings file is optional, return empty settings
    return { ok: true, value: {} };
  }

  try {
    const content = await readFile(settingsPath, "utf8");
    const data: unknown = JSON.parse(content);
    const parseResult = GeminiSettings.safeParse(data);

    if (!parseResult.success) {
      // Settings file is optional, ignore parse errors
      return { ok: true, value: {} };
    }

    return { ok: true, value: parseResult.data };
  } catch {
    // Settings file is optional, ignore read errors
    return { ok: true, value: {} };
  }
}

/**
 * Check if the access token is expired
 */
export function isTokenExpired(credentials: GeminiCredentials): boolean {
  // Add 60 second buffer to account for clock skew
  return credentials.expiry_date < Date.now() + 60_000;
}

/**
 * Extract email from JWT id_token
 */
export function extractEmailFromIdToken(idToken: string): string | undefined {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return undefined;

    const payload = parts[1];
    if (!payload) return undefined;

    // Convert base64url to base64
    let base64 = payload.replaceAll("-", "+").replaceAll("_", "/");

    // Add padding if needed
    const padLength = (4 - (base64.length % 4)) % 4;
    base64 += "=".repeat(padLength);

    // Decode base64
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    const claims = JSON.parse(decoded) as { email?: string };

    return claims.email;
  } catch {
    return undefined;
  }
}

/**
 * Get the selected auth type from settings
 */
export function getSelectedAuthType(
  settings: GeminiSettings,
): string | undefined {
  return settings.security?.auth?.selectedType;
}

/**
 * Validate that the auth type is supported (oauth-personal only)
 */
export function validateAuthType(authType?: string): Result<void, ApiError> {
  if (authType === "api-key") {
    return {
      ok: false,
      error: new ApiError(
        "Gemini API key auth not supported. Use Google account (OAuth) instead.",
      ),
    };
  }

  if (authType === "vertex-ai") {
    return {
      ok: false,
      error: new ApiError(
        "Gemini Vertex AI auth not supported. Use Google account (OAuth) instead.",
      ),
    };
  }

  return { ok: true, value: undefined };
}
