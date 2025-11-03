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
): Promise<void> {
  const page = await context.newPage();
  try {
    const config = getServiceAuthConfig(service);
    await page.goto(config.url);

    const selectors =
      config.waitForSelectors ??
      (config.waitForSelector ? [config.waitForSelector] : []);
    if (selectors.length > 0) {
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

    await context.storageState({ path: storagePath });
  } finally {
    await page.close();
  }
}
