import type { SupportedService } from "./supported-service.js";

/**
 * Service-specific configuration for authentication
 */
type ServiceAuthConfig = {
  readonly url: string;
  readonly waitForSelector?: string;
  readonly instructions: string;
};

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
    instructions:
      "Please log in to your ChatGPT account in the browser window.",
  },
  "github-copilot": {
    url: "https://github.com/login",
    waitForSelector: 'img[alt*="@"]',
    instructions: "Please log in to your GitHub account in the browser window.",
  },
};

export function getServiceAuthConfig(
  service: SupportedService,
): ServiceAuthConfig {
  return SERVICE_AUTH_CONFIGS[service];
}
