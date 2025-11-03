import type { BrowserContext } from "playwright";

const SESSION_ENDPOINTS = [
  "https://console.anthropic.com/api/auth/session",
  "https://console.anthropic.com/api/session",
  "https://console.anthropic.com/api/console/session",
];

/**
 * Fetch JSON from Anthropic API using a session/Bearer token from console.anthropic.com.
 * Falls back to console endpoint if API endpoint fails.
 */
export async function fetchClaudeJson(
  context: BrowserContext,
  url: string,
): Promise<string> {
  const page = await context.newPage();
  try {
    await page.goto("https://console.anthropic.com/", {
      waitUntil: "domcontentloaded",
    });

    const result = await page.evaluate(
      async (parameters: { targetUrl: string; endpoints: string[] }) => {
        async function getSessionToken(): Promise<string | undefined> {
          for (const ep of parameters.endpoints) {
            try {
              const response = await fetch(ep, {
                credentials: "include",
                headers: { Accept: "application/json" },
              });
              if (!response.ok) continue;
              const data: unknown = await response.json();
              let token: string | undefined;
              if (data && typeof data === "object") {
                const objectValue = data as Record<string, unknown> & {
                  user?: { accessToken?: string };
                };
                const candidates: unknown[] = [
                  objectValue.accessToken,
                  objectValue.token,
                  objectValue.idToken,
                  objectValue.jwt,
                  objectValue.user?.accessToken,
                ];
                const found = candidates.find((t) => typeof t === "string");
                token = typeof found === "string" ? found : undefined;
              }
              if (token) return token;
            } catch {
              // try next
            }
          }
          return undefined;
        }

        const token = await getSessionToken();
        // Build headers (with optional Bearer)
        const headers: Record<string, string> = {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        // Try original target first (api.anthropic.com)
        let response = await fetch(parameters.targetUrl, {
          credentials: "include",
          headers,
        });
        let attempt = {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type") || "",
          text: await response.text(),
        };
        if (!attempt.ok) {
          // Try console proxy if available
          const u = new URL(parameters.targetUrl);
          const consoleUrl = `https://console.anthropic.com${u.pathname}`;
          response = await fetch(consoleUrl, {
            credentials: "include",
            headers,
          });
          attempt = {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get("content-type") || "",
            text: await response.text(),
          };
        }
        return attempt;
      },
      { targetUrl: url, endpoints: SESSION_ENDPOINTS },
    );

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
