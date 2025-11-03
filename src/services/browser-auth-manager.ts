import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import { mkdir, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { SupportedService } from "./supported-service.js";
import { getServiceAuthConfig } from "./service-auth-configs.js";
import { launchChromium } from "./launch-chromium.js";
import { requestService } from "./request-service.js";
import { doSetupAuth } from "./do-setup-auth.js";
import { getStorageStatePathFor } from "./auth-storage-path.js";
import { createAuthContext } from "./create-auth-context.js";

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
    this.dataDir =
      config.dataDir ||
      path.join(homedir(), ".agent-usage", "browser-contexts");
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
      this.browserPromise = (async () => {
        const b = await launchChromium(this.headless);
        this.browser = b;
        return b;
      })();
    }
    return this.browserPromise;
  }

  /**
   * Set up authentication for a service by launching a browser for the user to log in
   */
  async setupAuth(service: SupportedService): Promise<void> {
    const config = getServiceAuthConfig(service);

    // Ensure data directory exists (restrict permissions to owner)
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 }).catch(
      (error: unknown) => {
        // mkdir may ignore mode due to umask; enforce via chmod
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          (error as { code?: unknown }).code !== "EEXIST"
        ) {
          throw error;
        }
      },
    );
    try {
      await chmod(this.dataDir, 0o700);
    } catch {
      // best effort
    }

    const browser = await this.ensureBrowser();
    const context = await browser.newContext();
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
