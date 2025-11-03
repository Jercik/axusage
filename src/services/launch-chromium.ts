import { chromium } from "playwright";
import type { Browser } from "playwright";

export async function launchChromium(headless: boolean): Promise<Browser> {
  try {
    return await chromium.launch({ headless });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|playwright\s+install/iu.test(message)) {
      throw new Error(
        "Playwright browsers are not installed. Run `pnpm exec playwright install chromium` or `npx playwright install chromium`, then retry.",
      );
    }
    throw error;
  }
}
