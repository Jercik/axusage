import type { BrowserContext } from "playwright";

/**
 * Fetch JSON using the page's fetch API so cookies/session are included without navigation.
 */
export async function fetchJsonWithContext(
  context: BrowserContext,
  url: string,
): Promise<string> {
  const page = await context.newPage();
  try {
    const origin = new URL(url).origin;
    await page.goto(origin + "/", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async (targetUrl) => {
      const response = await fetch(targetUrl, {
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type") || "",
        text,
      };
    }, url);

    if (!result.ok) {
      throw new Error(
        `Request failed: ${String(result.status)} ${result.statusText}`,
      );
    }
    if (!result.contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, got ${result.contentType}`);
    }
    return result.text;
  } finally {
    await page.close();
  }
}
