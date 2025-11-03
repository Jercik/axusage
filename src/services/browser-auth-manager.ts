import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";
import { verifySessionByFetching } from "./verify-session.js";
import { launchChromium } from "./launch-chromium.js";
import { waitForLogin } from "./wait-for-login.js";

/**
 * Configuration for browser authentication manager
 */
type BrowserAuthConfig = {
  readonly dataDir?: string;
  readonly headless?: boolean;
};

/**
 * Manages browser contexts for persistent authentication across services
 */
export class BrowserAuthManager {
  private readonly dataDir: string;
  private readonly headless: boolean;
  private browser: Browser | undefined = undefined;

  constructor(config: BrowserAuthConfig = {}) {
    this.dataDir =
      config.dataDir ||
      path.join(homedir(), ".agent-usage", "browser-contexts");
    this.headless = config.headless ?? false;
  }

  /**
   * Get the storage state file path for a service
   */
  private getStorageStatePath(service: SupportedService): string {
    return path.join(this.dataDir, `${service}-auth.json`);
  }

  /**
   * Check if a service has saved authentication
   */
  hasAuth(service: SupportedService): boolean {
    return existsSync(this.getStorageStatePath(service));
  }

  /**
   * Launch browser if not already launched
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await launchChromium(this.headless);
    }
    return this.browser;
  }

  /**
   * Set up authentication for a service by launching a browser for the user to log in
   */
  async setupAuth(service: SupportedService): Promise<void> {
    const config = getServiceAuthConfig(service);

    // Ensure data directory exists
    await mkdir(this.dataDir, { recursive: true });

    const browser = await this.ensureBrowser();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await page.goto(config.url);

      console.log(`\n${config.instructions}`);
      const selectors =
        config.waitForSelectors ??
        (config.waitForSelector ? [config.waitForSelector] : []);
      if (selectors.length > 0) {
        console.log(
          "Waiting for login to complete (or press Enter to continue)\n",
        );
        await waitForLogin(page, selectors);
      }

      // Optionally verify the session by hitting a JSON endpoint
      if (config.verifyUrl) {
        const ok = await verifySessionByFetching(context, config.verifyUrl);
        if (!ok) {
          console.warn(
            `\n⚠ Unable to verify session via ${config.verifyUrl}. Saving state anyway...`,
          );
        }
      }

      // Save the authenticated state
      await context.storageState({ path: this.getStorageStatePath(service) });
      console.log(
        `\n✓ Authentication saved for ${service}. You can now close the browser.`,
      );
    } finally {
      await context.close();
    }
  }

  /**
   * Get a browser context with saved authentication for a service
   */
  async getAuthContext(service: SupportedService): Promise<BrowserContext> {
    const storageStatePath = this.getStorageStatePath(service);

    if (!existsSync(storageStatePath)) {
      throw new Error(
        `No saved authentication for ${service}. Run 'agent-usage auth setup ${service}' first.`,
      );
    }

    const browser = await this.ensureBrowser();
    return browser.newContext({ storageState: storageStatePath });
  }

  /**
   * Make an authenticated request to a URL using the browser context
   */
  async makeAuthenticatedRequest(
    service: SupportedService,
    url: string,
  ): Promise<string> {
    const context = await this.getAuthContext(service);
    try {
      return await fetchJsonWithContext(context, url);
    } finally {
      await context.close();
    }
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}
