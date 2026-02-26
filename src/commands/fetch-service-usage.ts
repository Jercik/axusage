import type {
  ApiError,
  Result,
  ServiceResult,
  ServiceUsageData,
} from "../types/domain.js";
import { ApiError as ApiErrorClass } from "../types/domain.js";
import {
  getAvailableServices,
  getServiceAdapter,
  getServiceUsageFetcher,
} from "../services/service-adapter-registry.js";
import { getServiceInstanceConfigs } from "../config/credential-sources.js";
import { getInstanceAccessToken } from "../services/get-instance-access-token.js";
import { resolveInstanceDisplayName } from "../services/resolve-service-instances.js";
import type { SupportedService } from "../services/supported-service.js";

export type UsageCommandOptions = {
  readonly service?: string;
  readonly format?: "text" | "tsv" | "json" | "prometheus";
};

export function selectServicesToQuery(service?: string): string[] {
  const normalized = service?.toLowerCase();
  if (!service || normalized === "all") return getAvailableServices();
  return [service];
}

async function fetchServiceUsage(
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

/**
 * Fetch usage for all instances of a service type.
 *
 * For single-instance configs, produces one result (same as fetchServiceUsage).
 * For multi-instance configs, produces N results with resolved display names.
 */
export async function fetchServiceInstanceUsage(
  serviceType: string,
): Promise<ServiceResult[]> {
  const fetcher = getServiceUsageFetcher(serviceType);
  if (!fetcher) {
    const available = getAvailableServices().join(", ");
    return [
      {
        service: serviceType,
        result: {
          ok: false,
          error: new ApiErrorClass(
            `Unknown service "${serviceType}". Supported services: ${available}. ` +
              "Run 'axusage --help' for usage.",
          ),
        },
      },
    ];
  }

  const instanceConfigs = getServiceInstanceConfigs(
    serviceType as SupportedService,
  );

  // Single instance with no explicit displayName and local/auto source:
  // delegate to the existing adapter for backward compatibility
  if (instanceConfigs.length === 1) {
    const config = instanceConfigs[0] as (typeof instanceConfigs)[0];
    if (
      !config.displayName &&
      (config.source === "local" || (config.source === "auto" && !config.name))
    ) {
      const result = await fetchServiceUsage(serviceType);
      return [{ service: serviceType, result }];
    }
  }

  const results: ServiceResult[] = [];

  for (let index = 0; index < instanceConfigs.length; index++) {
    const config = instanceConfigs[index] as (typeof instanceConfigs)[0];

    const tokenResult = await getInstanceAccessToken(serviceType, config);

    if (!tokenResult.token) {
      const label = config.name ?? serviceType;
      results.push({
        service: serviceType,
        result: {
          ok: false,
          error: new ApiErrorClass(
            `No credentials found for ${label}. ` +
              (config.source === "vault"
                ? `Check that vault is configured and credential "${config.name ?? ""}" exists.`
                : `Run the agent CLI to authenticate.`),
          ),
        },
      });
      continue;
    }

    const usageResult = await fetcher.fetchUsageWithToken(tokenResult.token);

    if (usageResult.ok) {
      const displayName = resolveInstanceDisplayName(
        config.displayName,
        tokenResult.vaultDisplayName,
        fetcher.name,
        index,
        instanceConfigs.length,
      );

      results.push({
        service: serviceType,
        result: {
          ok: true,
          value: {
            ...usageResult.value,
            service: displayName,
            ...(tokenResult.vaultNotes !== undefined && {
              notes: tokenResult.vaultNotes,
            }),
          },
        },
      });
    } else {
      results.push({ service: serviceType, result: usageResult });
    }
  }

  return results;
}
