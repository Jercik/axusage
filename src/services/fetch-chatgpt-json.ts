import type { BrowserContext } from "playwright";
import { getChatGPTAccessToken } from "./get-chatgpt-access-token.js";

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
    const token = await getChatGPTAccessToken(page);
    type EvalResult = {
      ok: boolean;
      status: number;
      statusText: string;
      contentType: string;
      text: string;
    };
    const result: EvalResult = await page.evaluate(
      async ({
        targetUrl,
        accessToken,
      }: {
        targetUrl: string;
        accessToken?: string;
      }) => {
        if (!accessToken) {
          return {
            ok: false,
            status: 401,
            statusText: "No accessToken in session",
            contentType: "application/json",
            text: JSON.stringify({ error: "missing accessToken" }),
          } as EvalResult;
        }
        const apiResponse = await fetch(targetUrl, {
          credentials: "include",
          headers: {
            Accept: "application/json, text/plain, */*",
            Authorization: `Bearer ${accessToken}`,
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
        } as EvalResult;
      },
      { targetUrl: url, accessToken: token },
    );

    if (!result.ok) {
      throw new Error(
        `Request failed: ${String(result.status)} ${result.statusText}`,
      );
    }
    if (!result.contentType.toLowerCase().startsWith("application/json")) {
      throw new Error(`Expected JSON response, got ${result.contentType}`);
    }
    return result.text;
  } finally {
    await page.close();
  }
}
