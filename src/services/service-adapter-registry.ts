import type { ServiceAdapter } from "../types/domain.js";
import { chatGPTAdapter } from "../adapters/chatgpt.js";
import { claudeAdapter } from "../adapters/claude.js";
import { geminiAdapter } from "../adapters/gemini.js";
import { githubCopilotAdapter } from "../adapters/github-copilot.js";

/**
 * Registry of available service adapters
 */
export const SERVICE_ADAPTERS = {
  claude: claudeAdapter,
  chatgpt: chatGPTAdapter,
  "github-copilot": githubCopilotAdapter,
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
