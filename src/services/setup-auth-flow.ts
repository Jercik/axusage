import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { chmod } from "node:fs/promises";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";
import { getChatGPTAccessToken } from "./get-chatgpt-access-token.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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

/**
 * Polls for an active ChatGPT session until the deadline.
 *
 * Uses {@link getChatGPTAccessToken} on the provided Playwright `page` to
 * detect a successful login without relying on fixed selectors. The function
 * sleeps for {@link POLL_INTERVAL_MS} between attempts and returns as soon as
 * a valid access token is detected. If no session is established before the
 * provided `deadline` (epoch milliseconds), an error is thrown.
 *
 * @param page Playwright page associated with the ChatGPT login flow.
 * @param deadline Unix epoch timestamp in milliseconds after which polling
 *                 stops and the call fails with a timeout error.
 */
async function pollChatGPTSession(page: Page, deadline: number): Promise<void> {
  const reader = createInterface({ input, output });
  const manual = reader
    .question("Press Enter to continue without waiting for login... ")
    .then(() => {})
    // Prevent unhandled rejection when the interface is closed during normal flow
    .catch(() => {});

  try {
    while (Date.now() < deadline) {
      // Success path: session established
      if (await getChatGPTAccessToken(page)) return;

      // Wait for either a short poll interval or manual override
      // If the user presses Enter, the question promise resolves and we stop waiting further
      const winner = await Promise.race<true | false>([
        manual.then(() => true),
        page.waitForTimeout(POLL_INTERVAL_MS).then(() => false),
      ]);

      // If manual override already happened, exit early
      if (winner) return;
    }
  } finally {
    reader.close();
  }

  throw new Error(
    "Timed out waiting for ChatGPT session. If you've already completed login, press Enter in the terminal to continue manually. Otherwise, try again or check your network connection.",
  );
}
