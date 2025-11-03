import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { chmod } from "node:fs/promises";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";
import { getChatGPTAccessToken } from "./get-chatgpt-access-token.js";

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
      const ok = config.verifyFunction
        ? await config.verifyFunction(context, config.verifyUrl)
        : await verifySessionByFetching(context, config.verifyUrl);
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

// ChatGPT has a custom login readiness check (token polling). Verification uses
// config.verifyFunction when provided in service-auth-configs.

const POLL_INTERVAL_MS = 800;

async function pollChatGPTSession(page: Page, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    if (await getChatGPTAccessToken(page)) return;
    await page.waitForTimeout(POLL_INTERVAL_MS);
  }
  throw new Error(
    "Timed out waiting for ChatGPT session. Please ensure you completed the login process successfully. If the problem persists, try again or check your network connection.",
  );
}
