import type { ServiceAdapter, ServiceUsageFetcher } from "../types/domain.js";
import { codexAdapter, codexUsageFetcher } from "../adapters/codex.js";
import { claudeAdapter, claudeUsageFetcher } from "../adapters/claude.js";
import { geminiAdapter, geminiUsageFetcher } from "../adapters/gemini.js";
import { copilotAdapter, copilotUsageFetcher } from "../adapters/copilot.js";

/**
 * Registry of available service adapters
 */
export const SERVICE_ADAPTERS = {
  claude: claudeAdapter,
  codex: codexAdapter,
  copilot: copilotAdapter,
  gemini: geminiAdapter,
} as const satisfies Record<string, ServiceAdapter>;

/**
 * Registry of token-based usage fetchers (for multi-instance support)
 */
const SERVICE_USAGE_FETCHERS = {
  claude: claudeUsageFetcher,
  codex: codexUsageFetcher,
  copilot: copilotUsageFetcher,
  gemini: geminiUsageFetcher,
} as const satisfies Record<string, ServiceUsageFetcher>;

/**
 * Get a service adapter by name
 */
export function getServiceAdapter(name: string): ServiceAdapter | undefined {
  const key = name.toLowerCase() as keyof typeof SERVICE_ADAPTERS;
  return SERVICE_ADAPTERS[key];
}

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
  return Object.keys(SERVICE_ADAPTERS);
}
