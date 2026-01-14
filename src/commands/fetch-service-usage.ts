import type { ApiError, Result, ServiceUsageData } from "../types/domain.js";
import { ApiError as ApiErrorClass } from "../types/domain.js";
import {
  getAvailableServices,
  getServiceAdapter,
} from "../services/service-adapter-registry.js";

const ALL_SERVICES = ["claude", "chatgpt", "github-copilot", "gemini"] as const;

export type UsageCommandOptions = {
  readonly service?: string;
  readonly format?: "text" | "tsv" | "json" | "prometheus";
  readonly interactive?: boolean;
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
    const available = getAvailableServices().join(", ");
    return {
      ok: false,
      error: new ApiErrorClass(
        `Unknown service "${serviceName}". Supported services: ${available}. ` +
          "Run 'axusage --help' for usage.",
      ),
    };
  }

  return await adapter.fetchUsage();
}
