import type { SupportedService } from "./supported-service.js";
import type { BrowserContext } from "playwright";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";

/**
 * Service-specific configuration for authentication
 */
type ServiceAuthConfig = {
  readonly url: string;
  readonly waitForSelector?: string;
  readonly waitForSelectors?: readonly string[];
  readonly verifyUrl?: string;
  readonly verifyFunction?: (
    context: BrowserContext,
    url: string,
  ) => Promise<boolean>;
  readonly instructions: string;
};

const SERVICE_AUTH_CONFIGS: Record<SupportedService, ServiceAuthConfig> = {
  claude: {
    url: "https://claude.ai/settings/usage",
    waitForSelectors: [
      'a[href^="/settings"]',
      'button[aria-label*="Account" i]',
    ],
    instructions:
      "Please log in to your Anthropic account in the browser window.",
  },
  chatgpt: {
    url: "https://chatgpt.com/codex/settings/usage",
    waitForSelectors: [
      'button[aria-label="User menu"]',
      'a[href="/settings"]',
      'a[href^="/settings"]',
      'a[href^="/account"]',
    ],
    verifyUrl: "https://chatgpt.com/backend-api/wham/usage",
    verifyFunction: async (context, url) => {
      try {
        await fetchChatGPTJson(context, url);
        return true;
      } catch {
        return false;
      }
    },
    instructions:
      "Please log in to your ChatGPT account in the browser window.",
  },
  "github-copilot": {
    url: "https://github.com/login",
    waitForSelector: 'img[alt*="@"]',
    verifyUrl: "https://github.com/github-copilot/chat/entitlement",
    instructions: "Please log in to your GitHub account in the browser window.",
  },
};

export function getServiceAuthConfig(
  service: SupportedService,
): ServiceAuthConfig {
  return SERVICE_AUTH_CONFIGS[service];
}
