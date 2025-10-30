import type { ServiceAdapter } from "#types/domain";
import { claudeAdapter } from "#adapters/claude";
import { chatGPTAdapter } from "#adapters/chatgpt";
import { githubCopilotAdapter } from "#adapters/githubCopilot";

/**
 * Registry of available service adapters
 */
export const SERVICE_ADAPTERS = {
  claude: claudeAdapter,
  chatgpt: chatGPTAdapter,
  "github-copilot": githubCopilotAdapter,
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
