import type { ServiceUsageFetcher } from "../types/domain.js";
import { codexUsageFetcher } from "../adapters/codex.js";
import { claudeUsageFetcher } from "../adapters/claude.js";
import { geminiUsageFetcher } from "../adapters/gemini.js";
import { copilotUsageFetcher } from "../adapters/copilot.js";

/**
 * Registry of token-based usage fetchers
 */
const SERVICE_USAGE_FETCHERS = {
  claude: claudeUsageFetcher,
  codex: codexUsageFetcher,
  copilot: copilotUsageFetcher,
  gemini: geminiUsageFetcher,
} as const satisfies Record<string, ServiceUsageFetcher>;

/**
 * Get a token-based usage fetcher by service type
 */
export function getServiceUsageFetcher(
  name: string,
): ServiceUsageFetcher | undefined {
  const key = name.toLowerCase() as keyof typeof SERVICE_USAGE_FETCHERS;
  return SERVICE_USAGE_FETCHERS[key];
}

/**
 * Get all available service names
 */
export function getAvailableServices(): string[] {
  return Object.keys(SERVICE_USAGE_FETCHERS);
}
