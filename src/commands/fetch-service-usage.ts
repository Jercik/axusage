import type { ApiError, ServiceResult } from "../types/domain.js";
import { ApiError as ApiErrorClass } from "../types/domain.js";
import {
  getAvailableServices,
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

/**
 * Derive a stable instance identifier for metrics labeling.
 * Uses credential name when available, otherwise falls back to service type.
 */
function deriveInstanceId(
  serviceType: string,
  credentialName: string | undefined,
  index: number,
  total: number,
): string {
  if (credentialName) return credentialName;
  if (total === 1) return serviceType;
  return `${serviceType}-${String(index + 1)}`;
}

/**
 * Fetch usage for all instances of a service type.
 *
 * Resolves tokens and fetches usage for each configured instance in parallel.
 * Produces N results with resolved display names and stable instance IDs.
 */
export async function fetchServiceInstanceUsage(
  serviceType: string,
): Promise<ServiceResult[]> {
  const normalized = serviceType.toLowerCase();

  const fetcher = getServiceUsageFetcher(normalized);
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
    normalized as SupportedService,
  );

  const results = await Promise.all(
    instanceConfigs.map(async (config, index) => {
      const tokenResult = await getInstanceAccessToken(normalized, config);

      if (!tokenResult.token) {
        const label = config.name ?? normalized;
        const isVaultPath =
          config.source === "vault" ||
          (config.source === "auto" && config.name !== undefined);
        return {
          service: normalized,
          result: {
            ok: false as const,
            error: new ApiErrorClass(
              `No credentials found for ${label}. ` +
                (isVaultPath
                  ? `Check that vault is configured and credential "${config.name ?? ""}" exists.`
                  : `Run the agent CLI to authenticate.`),
            ),
          },
        };
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

        const instanceId = deriveInstanceId(
          normalized,
          config.name,
          index,
          instanceConfigs.length,
        );

        return {
          service: normalized,
          result: {
            ok: true as const,
            value: {
              ...usageResult.value,
              service: displayName,
              instanceId,
            },
          },
        };
      }

      return {
        service: normalized,
        result: usageResult as { ok: false; error: ApiError },
      };
    }),
  );

  return results;
}
