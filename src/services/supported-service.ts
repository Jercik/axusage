/**
 * Supported service names for usage tracking
 */
export type SupportedService =
  | "claude"
  | "chatgpt"
  | "github-copilot"
  | "gemini";

export const SUPPORTED_SERVICES: SupportedService[] = [
  "claude",
  "chatgpt",
  "github-copilot",
  "gemini",
];

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
