/**
 * Pure functions for resolving display names for service instances.
 *
 * Priority: config displayName > vault displayName > auto-number (multi) / adapter default (single)
 */

/**
 * Resolve the display name for a service instance.
 *
 * For single-instance configs: config displayName > vault displayName > adapter default name
 * For multi-instance without displayName: "Claude #1", "Claude #2"
 */
function resolveInstanceDisplayName(
  configDisplayName: string | undefined,
  vaultDisplayName: string | undefined,
  defaultName: string,
  index: number,
  total: number,
): string {
  // Explicit displayName always wins
  if (configDisplayName) return configDisplayName;
  if (vaultDisplayName) return vaultDisplayName;

  // Single instance: use adapter default
  if (total === 1) return defaultName;

  // Multi-instance without displayName: auto-number
  return `${defaultName} #${String(index + 1)}`;
}

export { resolveInstanceDisplayName };
