#!/usr/bin/env node

import { Command, Option } from "@commander-js/extra-typings";
import packageJson from "../package.json" with { type: "json" };
import { authClearCommand } from "./commands/auth-clear-command.js";
import { authSetupCommand } from "./commands/auth-setup-command.js";
import { authStatusCommand } from "./commands/auth-status-command.js";
import type { UsageCommandOptions } from "./commands/fetch-service-usage.js";
import { usageCommand } from "./commands/usage-command.js";
import { getCredentialSourcesPath } from "./config/credential-sources.js";
import { getBrowserContextsDirectory } from "./services/app-paths.js";
import { getAvailableServices } from "./services/service-adapter-registry.js";
import { installAuthManagerCleanup } from "./services/shared-browser-auth-manager.js";
import { configureColor } from "./utils/color.js";
import {
  getRootOptionsError,
  type RootOptions,
} from "./utils/validate-root-options.js";

// Parse --no-color early so help/error output is consistently uncolored.
const shouldDisableColor = process.argv.includes("--no-color");
configureColor({ enabled: shouldDisableColor ? false : undefined });

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .showHelpAfterError("(add --help for additional information)")
  .showSuggestionAfterError()
  .helpCommand(false)
  .option("--no-color", "disable color output")
  .option(
    "-s, --service <service>",
    `Service to query (${getAvailableServices().join(", ")}, all) - defaults to all`,
  )
  .option(
    "-i, --interactive",
    "allow interactive authentication prompts (usage reauth, --auth-setup/--auth-clear; ignored with --auth-status)",
  )
  .addOption(
    new Option("-o, --format <format>", "Output format")
      .choices(["text", "tsv", "json", "prometheus"])
      .default("text"),
  )
  .option(
    "--auth-setup <service>",
    "set up authentication for a service (CLI or browser-based)",
  )
  .option("--auth-status [service]", "check authentication status for services")
  .option(
    "--auth-clear <service>",
    "clear saved browser authentication for a service (moves files to system Trash)",
  )
  .option("-f, --force", "skip confirmation for destructive actions")
  .addHelpText(
    "after",
    () =>
      `\nExamples:\n  # Fetch usage for all services\n  ${packageJson.name}\n\n  # JSON output for a single service\n  ${packageJson.name} --service claude --format=json\n\n  # TSV output for piping to cut, awk, sort\n  ${packageJson.name} --format=tsv | tail -n +2 | awk -F'\\t' '{print $1, $4"%"}'\n\n  # Filter Prometheus metrics with standard tools\n  ${packageJson.name} --format=prometheus | grep axusage_utilization_percent\n\n  # Check authentication status for all services\n  ${packageJson.name} --auth-status\n\nStorage: ${getBrowserContextsDirectory()}\n(respects XDG_DATA_HOME and platform defaults)\nConfig file: ${getCredentialSourcesPath()}\n(respects AXUSAGE_SOURCES and platform defaults)\n\nRequires: claude, codex (ChatGPT), gemini (CLI auth); Playwright Chromium (GitHub Copilot auth)\nOverride CLI paths: AXUSAGE_CLAUDE_PATH, AXUSAGE_CODEX_PATH, AXUSAGE_GEMINI_PATH\nPlaywright: PLAYWRIGHT_BROWSERS_PATH\n`,
  );

function fail(message: string): void {
  console.error(`Error: ${message}`);
  console.error("Try 'axusage --help' for details.");
  if (process.exitCode === undefined) process.exitCode = 1;
}

program.action(async (options: RootOptions, command: Command) => {
  const errorMessage = getRootOptionsError(
    options,
    command.getOptionValueSource("format"),
  );
  if (errorMessage) {
    fail(errorMessage);
    return;
  }

  if (options.authSetup) {
    await authSetupCommand({
      service: options.authSetup,
      interactive: options.interactive,
    });
    return;
  }

  if (options.authStatus !== undefined) {
    const service =
      typeof options.authStatus === "string" && options.authStatus.length > 0
        ? options.authStatus
        : undefined;
    authStatusCommand({ service });
    return;
  }

  if (options.authClear) {
    await authClearCommand({
      service: options.authClear,
      interactive: options.interactive,
      force: options.force,
    });
    return;
  }

  const usageOptions: UsageCommandOptions = {
    service: options.service,
    format: options.format,
    interactive: options.interactive,
  };
  await usageCommand(usageOptions);
});

// Ensure browser resources are cleaned when process exits
installAuthManagerCleanup();

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (process.exitCode === undefined) process.exitCode = 1;
}
