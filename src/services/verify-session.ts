import type { BrowserContext } from "playwright";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

/**
 * Tries to fetch the given URL within the authenticated context.
 * Returns true if the request succeeds, false if it keeps failing.
 */
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 1500;

export async function verifySessionByFetching(
  context: BrowserContext,
  url: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  delayMs = DEFAULT_RETRY_DELAY_MS,
): Promise<boolean> {
  // Try up to `maxAttempts` times; some providers need a brief
  // delay for session cookies/tokens to settle after login.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fetchJsonWithContext(context, url);
      return true;
    } catch {
      // Wait a bit and try again; tokens/cookies may not be settled yet
      // Skip the delay after the final attempt to avoid unnecessary wait
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, delayMs);
        });
      }
    }
  }
  return false;
}
