import type { BrowserContext } from "playwright";

/**
 * Navigate to a URL within the given authenticated context and return the JSON response body as text.
 */
export async function fetchJsonWithContext(
  context: BrowserContext,
  url: string,
): Promise<string> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response) {
      throw new Error(`Failed to navigate to ${url}`);
    }

    if (!response.ok()) {
      throw new Error(
        `Request failed: ${String(response.status())} ${response.statusText()}`,
      );
    }

    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, got ${contentType}`);
    }

    return await response.text();
  } finally {
    await page.close();
  }
}
