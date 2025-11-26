import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { SupportedService } from "./supported-service.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "./auth-storage-path.js";

/**
 * Load the stored userAgent from the auth meta file for a service.
 * Returns undefined if meta file doesn't exist or is invalid.
 */
export async function loadStoredUserAgent(
  dataDirectory: string,
  service: SupportedService,
): Promise<string | undefined> {
  try {
    const metaPath = getAuthMetaPathFor(dataDirectory, service);
    const metaRaw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { userAgent?: string };
    return typeof meta.userAgent === "string" ? meta.userAgent : undefined;
  } catch {
    // no meta found; proceed without a custom user agent
    return undefined;
  }
}

export async function createAuthContext(
  browser: Browser,
  dataDirectory: string,
  service: SupportedService,
): Promise<BrowserContext> {
  const storageStatePath = getStorageStatePathFor(dataDirectory, service);

  if (!existsSync(storageStatePath)) {
    throw new Error(
      `No saved authentication for ${service}. Run 'agent-usage auth setup ${service}' first.`,
    );
  }

  const userAgent = await loadStoredUserAgent(dataDirectory, service);
  return browser.newContext({ storageState: storageStatePath, userAgent });
}
