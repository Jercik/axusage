import type { UsageCommandOptions } from "../commands/fetch-service-usage.js";

export type RootOptions = {
  readonly authSetup?: string;
  readonly authStatus?: string | boolean;
  readonly service?: UsageCommandOptions["service"];
  readonly format?: UsageCommandOptions["format"];
};

export function getRootOptionsError(
  options: RootOptions,
  formatSource?: string,
): string | undefined {
  // Commander sets optional args to `true` when provided without a value.
  const authSelectionCount =
    Number(Boolean(options.authSetup)) +
    Number(options.authStatus !== undefined);

  if (authSelectionCount > 1) {
    return "Use only one of --auth-setup or --auth-status.";
  }

  const hasExplicitFormat = formatSource === "cli";
  const hasUsageOptions = Boolean(options.service) || hasExplicitFormat;
  if (authSelectionCount > 0 && hasUsageOptions) {
    return "Usage options cannot be combined with auth operations.";
  }

  return undefined;
}
