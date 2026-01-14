import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { setupAuthInContext } from "./setup-auth-flow.js";
import path from "node:path";
import { getAuthMetaPathFor } from "./auth-storage-path.js";
import { writeAtomicJson } from "../utils/write-atomic-json.js";

export async function doSetupAuth(
  service: SupportedService,
  context: BrowserContext,
  storagePath: string,
  instructions: string,
): Promise<void> {
  console.error(`\n${instructions}`);
  console.error("Waiting for login to complete (or press Enter to continue)\n");
  const userAgent = await setupAuthInContext(service, context, storagePath);
  try {
    if (userAgent) {
      const metaPath = getAuthMetaPathFor(path.dirname(storagePath), service);
      await writeAtomicJson(metaPath, { userAgent }, 0o600);
    }
  } catch {
    // ignore errors when writing meta; not critical
  }
  console.error(
    `\n✓ Authentication saved for ${service}. You can now close the browser.`,
  );
}
