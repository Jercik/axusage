import { chromium } from "playwright";
import type { Browser, BrowserContext } from "playwright";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Service names that support browser-based authentication
 */
export type SupportedService = "claude" | "chatgpt" | "github-copilot";

/**
 * Configuration for browser authentication manager
 */
export type BrowserAuthConfig = {
  readonly dataDir?: string;
  readonly headless?: boolean;
};

/**
 * Service-specific configuration for authentication
 */
export type ServiceAuthConfig = {
  readonly url: string;
  readonly waitForSelector?: string;
  readonly instructions: string;
};

/**
 * Service authentication configurations
 */
const SERVICE_AUTH_CONFIGS: Record<SupportedService, ServiceAuthConfig> = {
  claude: {
    url: "https://console.anthropic.com",
    waitForSelector: 'a[href*="/settings/"]',
    instructions:
      "Please log in to your Anthropic account in the browser window.",
  },
  chatgpt: {
    url: "https://chatgpt.com",
    waitForSelector: 'div[data-testid="profile-button"]',
    instructions: "Please log in to your ChatGPT account in the browser window.",
  },
  "github-copilot": {
    url: "https://github.com/login",
    waitForSelector: 'img[alt*="@"]',
    instructions:
      "Please log in to your GitHub account in the browser window.",
  },
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
      this.browser = await chromium.launch({ headless: this.headless });
    }
    return this.browser;
  }

  /**
   * Set up authentication for a service by launching a browser for the user to log in
   */
  async setupAuth(service: SupportedService): Promise<void> {
    const config = SERVICE_AUTH_CONFIGS[service];

    // Ensure data directory exists
    await mkdir(this.dataDir, { recursive: true });

    const browser = await this.ensureBrowser();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await page.goto(config.url);

      console.log(`\n${config.instructions}`);
      if (config.waitForSelector) {
        console.log("Waiting for login to complete...\n");
        await page.waitForSelector(config.waitForSelector, { timeout: 300_000 }); // 5 minutes
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
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: "networkidle" });

      if (!response) {
        throw new Error(`Failed to navigate to ${url}`);
      }

      if (!response.ok()) {
        throw new Error(
          `Request failed: ${String(response.status())} ${response.statusText()}`,
        );
      }

      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      const body = await response.text();
      await page.close();

      return body;
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
