/**
 * Service names that support browser-based authentication
 */
export type SupportedService = "claude" | "chatgpt" | "github-copilot";

export const SUPPORTED_SERVICES: SupportedService[] = [
  "claude",
  "chatgpt",
  "github-copilot",
];

export function validateService(service: string | undefined): SupportedService {
  if (!service) {
    throw new Error(
      `Service is required. Supported services: ${SUPPORTED_SERVICES.join(", ")}`,
    );
  }

  const normalizedService = service.toLowerCase() as SupportedService;
  if (!SUPPORTED_SERVICES.includes(normalizedService)) {
    throw new Error(
      `Unsupported service: ${service}. Supported services: ${SUPPORTED_SERVICES.join(", ")}`,
    );
  }
  return normalizedService;
}
