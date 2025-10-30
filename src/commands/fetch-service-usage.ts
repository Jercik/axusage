import type { ApiError, Result, ServiceUsageData } from "../types/domain.js";
import { ApiError as ApiErrorClass } from "../types/domain.js";
import { getServiceAdapter } from "../services/service-adapter-registry.js";

const ALL_SERVICES = ["claude", "chatgpt", "github-copilot"] as const;
type KnownService = (typeof ALL_SERVICES)[number];

const ENV_VAR_CANDIDATES: Record<KnownService, readonly string[]> = {
  claude: ["CLAUDE_ACCESS_TOKEN"],
  chatgpt: ["CHATGPT_ACCESS_TOKEN"],
  "github-copilot": ["GITHUB_COPILOT_SESSION_TOKEN"],
} as const;

export type UsageCommandOptions = {
  readonly service?: string;
  readonly token?: string;
  readonly json?: boolean;
  readonly window?: string;
};

export function isKnownService(service: string): service is KnownService {
  return (ALL_SERVICES as readonly string[]).includes(service);
}

export function getEnvVarCandidates(service: string): readonly string[] {
  const normalized = service.toLowerCase();
  if (isKnownService(normalized)) {
    return ENV_VAR_CANDIDATES[normalized];
  }
  return [`${service.toUpperCase()}_ACCESS_TOKEN`];
}

export function selectServicesToQuery(service?: string): string[] {
  const normalized = service?.toLowerCase();
  if (!service || normalized === "all") return [...ALL_SERVICES];
  return [service];
}

export function getAccessToken(
  service: string,
  options: UsageCommandOptions,
): string | undefined {
  if (options.token) return options.token;
  const candidates = getEnvVarCandidates(service);
  for (const name of candidates) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export async function fetchServiceUsage(
  serviceName: string,
  options: UsageCommandOptions,
): Promise<Result<ServiceUsageData, ApiError>> {
  const adapter = getServiceAdapter(serviceName);
  if (!adapter) {
    return {
      ok: false,
      error: new ApiErrorClass(`Unknown service "${serviceName}"`),
    };
  }

  const accessToken = getAccessToken(serviceName, options);
  if (!accessToken) {
    const candidates = getEnvVarCandidates(serviceName);
    const display = candidates.join(" or ");
    return {
      ok: false,
      error: new ApiErrorClass(`${display} is not set`),
    };
  }

  return await adapter.fetchUsage({ accessToken });
}
