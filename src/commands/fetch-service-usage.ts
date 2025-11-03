import type { ApiError, Result, ServiceUsageData } from "../types/domain.js";
import { ApiError as ApiErrorClass } from "../types/domain.js";
import { getServiceAdapter } from "../services/service-adapter-registry.js";

const ALL_SERVICES = ["claude", "chatgpt", "github-copilot"] as const;

export type UsageCommandOptions = {
  readonly service?: string;
  readonly json?: boolean;
  readonly window?: string;
};

export function selectServicesToQuery(service?: string): string[] {
  const normalized = service?.toLowerCase();
  if (!service || normalized === "all") return [...ALL_SERVICES];
  return [service];
}

export async function fetchServiceUsage(
  serviceName: string,
): Promise<Result<ServiceUsageData, ApiError>> {
  const adapter = getServiceAdapter(serviceName);
  if (!adapter) {
    return {
      ok: false,
      error: new ApiErrorClass(`Unknown service "${serviceName}"`),
    };
  }

  return await adapter.fetchUsage();
}
