/**
 * Configuration for credential sources per service.
 *
 * Supports three modes:
 * - "local": Use local credentials from axauth (default behavior)
 * - "vault": Fetch credentials from axvault server
 * - "auto": Try vault first if configured and credential name provided, fallback to local
 */

import Conf from "conf";
import envPaths from "env-paths";
import path from "node:path";
import { z } from "zod";

import type { SupportedService } from "../services/supported-service.js";

/** Credential source type */
const CredentialSourceType = z.enum(["auto", "local", "vault"]);
type CredentialSourceType = z.infer<typeof CredentialSourceType>;

/** Service source config - either a string shorthand or object with name */
const ServiceSourceConfig = z.union([
  CredentialSourceType,
  z.object({
    source: CredentialSourceType,
    name: z.string().optional(),
  }),
]);
type ServiceSourceConfig = z.infer<typeof ServiceSourceConfig>;

/** Full sources config - map of service ID to source config */
const SourcesConfig = z.record(z.string(), ServiceSourceConfig);
type SourcesConfig = z.infer<typeof SourcesConfig>;

/** Resolved source config with normalized fields */
interface ResolvedSourceConfig {
  source: CredentialSourceType;
  name: string | undefined;
}

// Lazy-initialized config instance
let configInstance: Conf<{ sources?: SourcesConfig }> | undefined;

function getConfig(): Conf<{ sources?: SourcesConfig }> {
  if (!configInstance) {
    configInstance = new Conf<{ sources?: SourcesConfig }>({
      projectName: "axusage",
      projectSuffix: "",
      schema: {
        sources: {
          type: "object",
          additionalProperties: true,
        },
      },
    });
    // Migration runs once per process when the config is first initialized.
    migrateLegacySources(configInstance);
  }
  return configInstance;
}

function migrateLegacySources(config: Conf<{ sources?: SourcesConfig }>): void {
  // Respect explicit new config values; never overwrite them with legacy data.
  if (config.get("sources") !== undefined) return;

  // Conf defaults to the legacy "-nodejs" suffix, which matches older configs.
  const legacyConfig = new Conf<{ sources?: SourcesConfig }>({
    projectName: "axusage",
  });
  const legacySources = legacyConfig.get("sources");
  if (!legacySources) return;

  const parsed = SourcesConfig.safeParse(legacySources);
  if (!parsed.success) {
    console.error(
      "Warning: Legacy axusage config contains invalid sources; skipping migration. Check your legacy config and migrate manually if needed.",
    );
    return;
  }

  config.set("sources", parsed.data);
  console.error(
    "Migrated credential source configuration from legacy axusage-nodejs config path.",
  );
}

/**
 * Get the full credential source configuration.
 *
 * Priority:
 * 1. AXUSAGE_SOURCES environment variable (flat JSON)
 * 2. Config file sources key
 * 3. Empty object (defaults apply per-service)
 */
function getCredentialSourceConfig(): SourcesConfig {
  // Priority 1: Environment variable
  const environmentVariable = process.env.AXUSAGE_SOURCES;
  if (environmentVariable) {
    try {
      const parsed = SourcesConfig.parse(JSON.parse(environmentVariable));
      return parsed;
    } catch (error) {
      const reason =
        error instanceof SyntaxError
          ? "invalid JSON syntax"
          : "schema validation failed";
      console.error(
        `Warning: AXUSAGE_SOURCES ${reason}, falling back to config file`,
      );
    }
  }

  // Priority 2: Config file
  const config = getConfig();
  const fileConfig = config.get("sources");
  if (fileConfig) {
    const parsed = SourcesConfig.safeParse(fileConfig);
    if (parsed.success) {
      return parsed.data;
    }
    console.error(
      "Warning: Config file contains invalid sources, using defaults",
    );
  }

  // Priority 3: Empty (defaults apply)
  return {};
}

/**
 * Get the resolved source config for a specific service.
 *
 * @param service - Service ID (e.g., "claude", "codex", "gemini")
 * @returns Resolved config with source type and optional credential name
 */
function getServiceSourceConfig(
  service: SupportedService,
): ResolvedSourceConfig {
  const config = getCredentialSourceConfig();
  const serviceConfig = config[service];

  // Default: auto mode with no credential name
  if (serviceConfig === undefined) {
    return { source: "auto", name: undefined };
  }

  // String shorthand: just the source type
  if (typeof serviceConfig === "string") {
    return { source: serviceConfig, name: undefined };
  }

  // Object: source and name
  return { source: serviceConfig.source, name: serviceConfig.name };
}

/**
 * Get the credential sources config file path.
 *
 * This computes the path using env-paths directly instead of instantiating
 * Conf, which avoids all filesystem side effects (Conf creates the config
 * directory during construction).
 */
function getCredentialSourcesPath(): string {
  const configDirectory = envPaths("axusage", { suffix: "" }).config;
  return path.resolve(configDirectory, "config.json");
}

export { getServiceSourceConfig, getCredentialSourcesPath };
