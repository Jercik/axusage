import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { SupportedService } from "./supported-service.js";
import {
  getAuthMetaPathFor,
  getStorageStatePathFor,
} from "./auth-storage-path.js";

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

  let userAgent: string | undefined;
  try {
    const metaPath = getAuthMetaPathFor(dataDirectory, service);
    const metaRaw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { userAgent?: string };
    userAgent = typeof meta.userAgent === "string" ? meta.userAgent : undefined;
  } catch {
    // no meta found; proceed without a custom user agent
  }

  return browser.newContext({ storageState: storageStatePath, userAgent });
}
