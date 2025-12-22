import type { SupportedService } from "./supported-service.js";
import type { BrowserContext } from "playwright";

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
  // Claude uses CLI-based auth via Claude Code credentials
  claude: {
    url: "",
    instructions:
      "Claude uses Claude Code authentication. Run 'claude' in your terminal to authenticate.",
  },
  // ChatGPT uses CLI-based auth via Codex credentials
  chatgpt: {
    url: "",
    instructions:
      "ChatGPT uses Codex CLI authentication. Run 'codex' in your terminal to authenticate.",
  },
  "github-copilot": {
    url: "https://github.com/login",
    waitForSelector: 'img[alt*="@"]',
    verifyUrl: "https://github.com/github-copilot/chat/entitlement",
    instructions: "Please log in to your GitHub account in the browser window.",
  },
  // Gemini uses CLI-based auth, not browser auth. This entry exists only to satisfy the Record type.
  gemini: {
    url: "",
    instructions:
      "Gemini uses CLI-based authentication. Run 'gemini' in your terminal.",
  },
};

export function getServiceAuthConfig(
  service: SupportedService,
): ServiceAuthConfig {
  return SERVICE_AUTH_CONFIGS[service];
}
