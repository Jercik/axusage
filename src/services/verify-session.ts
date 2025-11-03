import type { BrowserContext } from "playwright";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

/**
 * Tries to fetch the given URL within the authenticated context.
 * Returns true if the request succeeds, false if it keeps failing.
 */
export async function verifySessionByFetching(
  context: BrowserContext,
  url: string,
  retries = 5,
  delayMs = 1500,
): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fetchJsonWithContext(context, url);
      return true;
    } catch {
      // Wait a bit and try again; tokens/cookies may not be settled yet
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
