import type { BrowserContext, Page } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { waitForLogin } from "./wait-for-login.js";
import type { LoginWaitOutcome } from "./wait-for-login.js";
import { verifySessionByFetching } from "./verify-session.js";
import { writeAtomicJson } from "../utils/write-atomic-json.js";

function describeLoginOutcome(outcome: LoginWaitOutcome): string {
  switch (outcome) {
    case "manual": {
      return "after manual continuation";
    }
    case "timeout": {
      return "after login timeout";
    }
    case "closed": {
      return "after the browser window closed";
    }
    case "aborted": {
      return "after prompt cancellation";
    }
    case "selector": {
      return "after detecting a login signal";
    }
    case "skipped": {
      return "without waiting for a login signal";
    }
  }
}

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
    const outcomeLabel = describeLoginOutcome(loginOutcome);

    if (config.verifyUrl) {
      const ok = config.verifyFunction
        ? await config.verifyFunction(context, config.verifyUrl)
        : await verifySessionByFetching(context, config.verifyUrl);
      if (!ok) {
        throw new Error(
          `Unable to verify session via ${config.verifyUrl} ${outcomeLabel}. Authentication was not saved.`,
        );
      }
    } else if (selectors.length > 0 && loginOutcome !== "selector") {
      // Without a verification URL, we only persist when a login selector confirms success.
      throw new Error(
        `Login was not confirmed ${outcomeLabel}. Authentication was not saved.`,
      );
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
  // When no selectors are configured, skip waiting and rely on verification if available.
  return "skipped";
}
