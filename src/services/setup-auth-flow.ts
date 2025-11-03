import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";
import { chmod } from "node:fs/promises";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";

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

    await waitForLoginForService(service, page, selectors);

    if (config.verifyUrl) {
      const ok = await verifySessionForService(
        service,
        context,
        config.verifyUrl,
      );
      if (!ok) {
        console.warn(
          `\n⚠ Unable to verify session via ${config.verifyUrl}. Saving state anyway...`,
        );
      }
    }

    // Capture user agent for future headless contexts
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await context.storageState({ path: storagePath });
    try {
      await chmod(storagePath, 0o600);
    } catch {
      // best effort to restrict sensitive storage state
    }
    return userAgent;
  } finally {
    await page.close();
  }
}

async function waitForLoginForService(
  service: SupportedService,
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  if (service === "chatgpt") {
    // Robust poll from Node-side to survive navigations
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    await pollChatGPTSession(page, deadline);
    return;
  }
  if (selectors.length > 0) {
    await waitForLogin(page, selectors);
  }
}

async function verifySessionForService(
  service: SupportedService,
  context: BrowserContext,
  verifyUrl: string,
): Promise<boolean> {
  if (service === "chatgpt") {
    try {
      await fetchChatGPTJson(context, verifyUrl);
      return true;
    } catch {
      return false;
    }
  }
  return verifySessionByFetching(context, verifyUrl);
}

const POLL_INTERVAL_MS = 800;

async function pollChatGPTSession(page: Page, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const token = await page.evaluate(async () => {
        try {
          const response = await fetch("https://chatgpt.com/api/auth/session", {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!response.ok) return;
          const data: unknown = await response.json();
          if (
            data &&
            typeof data === "object" &&
            "accessToken" in data &&
            typeof (data as { accessToken?: unknown }).accessToken ===
              "string" &&
            (data as { accessToken?: string }).accessToken
          ) {
            return (data as { accessToken: string }).accessToken;
          }
        } catch {
          return;
        }
      });
      if (token) return;
    } catch {
      // Execution context may be destroyed during login redirects; retry.
    }
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
  throw new Error("Timed out waiting for ChatGPT session to become available");
}
