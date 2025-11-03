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
  const manual = reader.question("");
  const waiters = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout: 300_000 }),
  );
  try {
    await Promise.race([manual, ...waiters]);
  } finally {
    reader.close();
  }
}
