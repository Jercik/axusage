import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";

export async function setupAuthInContext(
  service: SupportedService,
  context: BrowserContext,
  storagePath: string,
): Promise<string | undefined> {
  const page = await context.newPage();
  try {
    const config = getServiceAuthConfig(service);
    await page.goto(config.url);

    const selectors =
      config.waitForSelectors ??
      (config.waitForSelector ? [config.waitForSelector] : []);

    if (service === "chatgpt") {
      // Robust poll from Node-side to survive navigations
      const deadline = Date.now() + 90_000;
      for (; Date.now() <= deadline; ) {
        try {
          const token = await page.evaluate(async () => {
            try {
              const response = await fetch(
                "https://chatgpt.com/api/auth/session",
                {
                  credentials: "include",
                  headers: { Accept: "application/json" },
                },
              );
              if (!response.ok) return;
              const data = (await response.json()) as { accessToken?: string };
              if (typeof data.accessToken === "string" && data.accessToken) {
                return data.accessToken;
              }
            } catch {
              return;
            }
          });
          if (token) break;
        } catch {
          // Execution context may be destroyed during login redirects; retry.
        }
        await page.waitForTimeout(800);
      }
    } else if (selectors.length > 0) {
      await waitForLogin(page, selectors);
    }

    if (config.verifyUrl) {
      let ok = false;
      if (service === "chatgpt") {
        try {
          await fetchChatGPTJson(context, config.verifyUrl);
          ok = true;
        } catch {
          ok = false;
        }
      } else {
        ok = await verifySessionByFetching(context, config.verifyUrl);
      }
      if (!ok) {
        console.warn(
          `\n⚠ Unable to verify session via ${config.verifyUrl}. Saving state anyway...`,
        );
      }
    }

    // Capture user agent for future headless contexts
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await context.storageState({ path: storagePath });
    return userAgent;
  } finally {
    await page.close();
  }
}
