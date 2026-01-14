import type { UsageCommandOptions } from "../commands/fetch-service-usage.js";

export type RootOptions = {
  readonly authSetup?: string;
  readonly authStatus?: string | boolean;
  readonly authClear?: string;
  readonly force?: boolean;
  readonly service?: UsageCommandOptions["service"];
  readonly format?: UsageCommandOptions["format"];
  readonly interactive?: UsageCommandOptions["interactive"];
};

export function getRootOptionsError(
  options: RootOptions,
  formatSource?: string,
): string | undefined {
  const authSelectionCount =
    Number(Boolean(options.authSetup)) +
    Number(options.authStatus !== undefined) +
    Number(Boolean(options.authClear));

  if (authSelectionCount > 1) {
    return "Use only one of --auth-setup, --auth-status, or --auth-clear.";
  }

  if (options.force && !options.authClear) {
    return "--force is only supported with --auth-clear.";
  }

  const hasExplicitFormat = formatSource === "cli";
  const hasUsageOptions = Boolean(options.service) || hasExplicitFormat;
  if (authSelectionCount > 0 && hasUsageOptions) {
    return "Usage options cannot be combined with auth operations.";
  }

  return undefined;
}
