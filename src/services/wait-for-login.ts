import type { Page } from "playwright";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
  const LOGIN_TIMEOUT_MS = 300_000; // 5 minutes
  const timeoutMs = LOGIN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  // Prevent unhandled rejections if the page closes before all waiters finish
  const waiters = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout: timeoutMs }).catch(() => {
      // Intentionally ignored: the page may navigate/close before selector resolves
    }),
  );
  const interval = setInterval(() => {
    const remaining = Math.max(0, deadline - Date.now());
    // Round up to the next minute for clearer UX
    const minutes = Math.ceil(remaining / 60_000);
    console.log(
      `Still waiting for login... ${String(minutes)} minute(s) remaining`,
    );
  }, 60_000);
  try {
    await Promise.race([manual, ...waiters]);
  } finally {
    clearInterval(interval);
    reader.close();
  }
}
