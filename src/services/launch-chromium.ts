import { chromium } from "playwright";
import type { Browser } from "playwright";

/**
 * Launch Chromium with automation indicators disabled to reduce Cloudflare bot detection
 * during the authentication flow.
 */
export async function launchChromium(headless: boolean): Promise<Browser> {
  try {
    return await chromium.launch({
      headless,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|playwright\s+install/iu.test(message)) {
      throw new Error(
        "Playwright browsers are not installed. This is usually handled automatically by the postinstall script in package.json. Please try reinstalling the package or check if the postinstall script ran successfully. If the problem persists, you can manually run `pnpm exec playwright install chromium` or `npx playwright install chromium`, then retry.",
      );
    }
    throw error;
  }
}
