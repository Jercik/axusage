import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { launchChromium } from "./launch-chromium.js";
import { requestService } from "./request-service.js";
import { doSetupAuth } from "./do-setup-auth.js";
import { getStorageStatePathFor } from "./auth-storage-path.js";
import {
  createAuthContext,
  loadStoredUserAgent,
} from "./create-auth-context.js";
import {
  getBrowserContextsDirectory,
  ensureSecureDirectory,
} from "./app-paths.js";
import { persistStorageState } from "./persist-storage-state.js";

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
  private browserPromise: Promise<Browser> | undefined = undefined;

  constructor(config: BrowserAuthConfig = {}) {
    this.dataDir = config.dataDir || getBrowserContextsDirectory();
    // Default to headless for non-interactive usage flows; auth setup passes headless: false
    this.headless = config.headless ?? true;
  }

  /**
   * Get the storage state file path for a service
   */
  private getStorageStatePath(service: SupportedService): string {
    return getStorageStatePathFor(this.dataDir, service);
  }

  /**
   * Check if a service has saved authentication
   */
  hasAuth(service: SupportedService): boolean {
    return existsSync(this.getStorageStatePath(service));
  }

  /**
   * Ensure a Chromium browser instance is available
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.launchAndStoreBrowser();
    }
    return this.browserPromise;
  }

  private async launchAndStoreBrowser(): Promise<Browser> {
    try {
      const browser = await launchChromium(this.headless);
      this.browser = browser;
      return browser;
    } catch (error) {
      // Allow retries on subsequent calls if the launch fails
      this.browserPromise = undefined;
      throw error;
    }
  }

  /**
   * Set up authentication for a service by launching a browser for the user to log in
   */
  async setupAuth(service: SupportedService): Promise<void> {
    const config = getServiceAuthConfig(service);
    await ensureSecureDirectory(this.dataDir);

    const browser = await this.ensureBrowser();
    const storagePath = this.getStorageStatePath(service);

    // Load existing storage state if available - this gives the browser a chance
    // to refresh expired cookies/tokens during the login flow
    const storageState = existsSync(storagePath) ? storagePath : undefined;
    const userAgent = await loadStoredUserAgent(this.dataDir, service);

    let context: BrowserContext;
    try {
      context = await browser.newContext({ storageState, userAgent });
    } catch {
      // Corrupted storage state - fall back to fresh context
      context = await browser.newContext({ userAgent });
    }
    try {
      await doSetupAuth(
        service,
        context,
        this.getStorageStatePath(service),
        config.instructions,
      );
    } finally {
      await context.close();
    }
  }

  /**
   * Get a browser context with saved authentication for a service
   */
  async getAuthContext(service: SupportedService): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    return createAuthContext(browser, this.dataDir, service);
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
      return await requestService(service, url, () => Promise.resolve(context));
    } finally {
      await persistStorageState(context, this.getStorageStatePath(service));
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
      this.browserPromise = undefined;
    }
  }
}
