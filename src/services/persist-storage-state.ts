import type { BrowserContext } from "playwright";
import { chmod } from "node:fs/promises";

/**
 * Persist context storage state to disk with secure permissions (0o600).
 * Errors are silently ignored to avoid blocking the main operation.
 */
export async function persistStorageState(
  context: BrowserContext,
  storagePath: string,
): Promise<void> {
  try {
    await context.storageState({ path: storagePath });
    await chmod(storagePath, 0o600).catch(() => {
      // best effort: permissions may already be correct or OS may ignore
    });
  } catch {
    // ignore persistence errors; do not block request completion
  }
}
