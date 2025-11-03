import type { Page } from "playwright";

/**
 * Retrieves the ChatGPT web session access token from the page context.
 * Returns undefined when unauthenticated or on transient errors.
 */
export async function getChatGPTAccessToken(
  page: Page,
): Promise<string | undefined> {
  try {
    const token = await page.evaluate(async () => {
      try {
        const resp = await fetch("https://chatgpt.com/api/auth/session", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!resp.ok) return;
        const data: unknown = await resp.json();
        if (
          data &&
          typeof data === "object" &&
          "accessToken" in data &&
          typeof (data as { accessToken?: unknown }).accessToken === "string" &&
          (data as { accessToken?: string }).accessToken
        ) {
          return (data as { accessToken: string }).accessToken;
        }
        return;
      } catch {
        return;
      }
    });
    if (token && typeof token === "string") return token;
    return undefined;
  } catch {
    // Execution context may be temporarily unavailable during redirects
    return undefined;
  }
}
