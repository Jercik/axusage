import type { BrowserContext } from "playwright";
import { writeAtomicJson } from "../utils/write-atomic-json.js";

/**
 * Persist context storage state to disk with secure permissions (0o600).
 * Errors are silently ignored to avoid blocking the main operation.
 */
export async function persistStorageState(
  context: BrowserContext,
  storagePath: string,
): Promise<void> {
  try {
    const state = await context.storageState();
    await writeAtomicJson(storagePath, state, 0o600);
  } catch {
    // ignore persistence errors; do not block request completion
  }
}
