import type { ServiceAdapter } from "../types/domain.js";
import { codexAdapter } from "../adapters/codex.js";
import { claudeAdapter } from "../adapters/claude.js";
import { geminiAdapter } from "../adapters/gemini.js";
import { copilotAdapter } from "../adapters/copilot.js";

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
 * Get a service adapter by name
 */
export function getServiceAdapter(name: string): ServiceAdapter | undefined {
  const key = name.toLowerCase() as keyof typeof SERVICE_ADAPTERS;
  return SERVICE_ADAPTERS[key];
}

/**
 * Get all available service names
 */
export function getAvailableServices(): string[] {
  return Object.keys(SERVICE_ADAPTERS);
}
