import type { Page } from "playwright";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";

/**
 * Waits until one of the selectors appears on the page, or the user presses Enter to continue.
 */
export async function waitForLogin(
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  const reader = createInterface({ input, output });
  const manual = reader.question(
    "Press Enter to continue without waiting for login... ",
  );
  // Absorb rejection when the interface is closed to prevent
  // unhandled promise rejection (AbortError) after a selector wins.
  const manualSilenced = manual.catch(() => {});
  const timeoutMs = LOGIN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  // Prevent unhandled rejections if the page closes before all waiters finish
  const waiters = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {
      // Intentionally ignored: the page may navigate/close before selector resolves
    }),
  );
  const interval = setInterval(() => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      // Stop logging once timeout elapses to avoid confusing "0 minute(s)" spam
      clearInterval(interval);
      console.log("Login wait timed out; finishing up...");
      return;
    }
    // Round up to the next minute for clearer UX, ensure at least 1
    const minutes = Math.max(1, Math.ceil(remaining / 60_000));
    console.log(
      `Still waiting for login... ${String(minutes)} minute(s) remaining`,
    );
  }, 60_000);
  try {
    await Promise.race([manualSilenced, ...waiters]);
  } finally {
    clearInterval(interval);
    reader.close();
  }
}
