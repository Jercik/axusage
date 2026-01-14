import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import type { LoginWaitOutcome } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { writeAtomicJson } from "../utils/write-atomic-json.js";

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

    const loginOutcome = await waitForLoginForService(page, selectors);

    if (config.verifyUrl) {
      const ok = config.verifyFunction
        ? await config.verifyFunction(context, config.verifyUrl)
        : await verifySessionByFetching(context, config.verifyUrl);
      if (!ok) {
        const outcomeLabel =
          loginOutcome === "manual"
            ? "after manual continuation"
            : loginOutcome === "timeout"
              ? "after login timeout"
              : "without detecting a login signal";
        throw new Error(
          `Unable to verify session via ${config.verifyUrl} ${outcomeLabel}. Authentication was not saved.`,
        );
      }
    } else if (selectors.length > 0 && loginOutcome !== "selector") {
      throw new Error("Login was not confirmed; authentication was not saved.");
    }

    // Capture user agent for future headless contexts
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const state = await context.storageState();
    await writeAtomicJson(storagePath, state, 0o600);
    return userAgent;
  } finally {
    await page.close();
  }
}

async function waitForLoginForService(
  page: Page,
  selectors: readonly string[],
): Promise<LoginWaitOutcome> {
  if (selectors.length > 0) {
    return waitForLogin(page, selectors);
  }
  return "skipped";
}
