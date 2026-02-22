import type { AgentCli } from "axauth";
import { AGENT_CLIS } from "axauth";

/**
 * Supported service names for usage tracking.
 *
 * Derived from the canonical AGENT_CLIS list, excluding agents
 * that axusage doesn't yet support (opencode).
 */
export type SupportedService = Exclude<AgentCli, "opencode">;

export const SUPPORTED_SERVICES: SupportedService[] = AGENT_CLIS.filter(
  (cli): cli is SupportedService => cli !== "opencode",
);

export function validateService(service: string | undefined): SupportedService {
  if (!service) {
    throw new Error(
      `Service is required. Supported services: ${SUPPORTED_SERVICES.join(", ")}. ` +
        "Run 'axusage --help' for usage.",
    );
  }

  const normalizedService = service.toLowerCase() as SupportedService;
  if (!SUPPORTED_SERVICES.includes(normalizedService)) {
    throw new Error(
      `Unsupported service: ${service}. Supported services: ${SUPPORTED_SERVICES.join(", ")}. ` +
        "Run 'axusage --help' for usage.",
    );
  }
  return normalizedService;
}
