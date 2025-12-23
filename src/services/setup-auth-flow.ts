import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { chmod } from "node:fs/promises";

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

    await waitForLoginForService(page, selectors);

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
  page: Page,
  selectors: readonly string[],
): Promise<void> {
  if (selectors.length > 0) {
    await waitForLogin(page, selectors);
  }
}
