import type { BrowserContext } from "playwright";

/**
 * Fetch JSON from ChatGPT backend API using the web session token.
 * Requires that the context is authenticated for chatgpt.com.
 */
export async function fetchChatGPTJson(
  context: BrowserContext,
  url: string,
): Promise<string> {
  const page = await context.newPage();
  try {
    await page.goto("https://chatgpt.com/", { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(async (targetUrl) => {
      const sessionResponse = await fetch(
        "https://chatgpt.com/api/auth/session",
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      if (!sessionResponse.ok) {
        return {
          ok: false,
          status: sessionResponse.status,
          statusText: sessionResponse.statusText,
          contentType: sessionResponse.headers.get("content-type") || "",
          text: await sessionResponse.text(),
        };
      }
      const session = (await sessionResponse.json()) as {
        accessToken?: string;
      };
      const token = session.accessToken;
      if (!token) {
        return {
          ok: false,
          status: 401,
          statusText: "No accessToken in session",
          contentType: "application/json",
          text: JSON.stringify({ error: "missing accessToken" }),
        };
      }

      const apiResponse = await fetch(targetUrl, {
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      const text = await apiResponse.text();
      return {
        ok: apiResponse.ok,
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        contentType: apiResponse.headers.get("content-type") || "",
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
