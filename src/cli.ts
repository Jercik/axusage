#!/usr/bin/env node

import { Command, Option } from "@commander-js/extra-typings";
import packageJson from "../package.json" with { type: "json" };
import { usageCommand } from "./commands/usage-command.js";
import { authSetupCommand } from "./commands/auth-setup-command.js";
import { authStatusCommand } from "./commands/auth-status-command.js";
import { authClearCommand } from "./commands/auth-clear-command.js";
import type { UsageCommandOptions } from "./commands/fetch-service-usage.js";
import { getAvailableServices } from "./services/service-adapter-registry.js";
import { installAuthManagerCleanup } from "./services/shared-browser-auth-manager.js";
import { getBrowserContextsDirectory } from "./services/app-paths.js";

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)
  .showHelpAfterError("(add --help for additional information)")
  .showSuggestionAfterError()
  .helpCommand(false)
  .addHelpText(
    "after",
    `\nExamples:\n  # Fetch usage for all services\n  ${packageJson.name}\n\n  # JSON output for a single service\n  ${packageJson.name} --service claude --format=json\n\n  # Filter Prometheus metrics with standard tools\n  ${packageJson.name} --format=prometheus | grep agent_usage_utilization_percent\n`,
  );

// Ensure browser resources are cleaned when process exits
installAuthManagerCleanup();

// Usage command (default)
program
  .command("usage", { isDefault: true })
  .description(
    "Fetch API usage statistics (defaults to all: Claude, ChatGPT, GitHub Copilot)",
  )
  .option(
    "-s, --service <service>",
    `Service to query (${getAvailableServices().join(", ")}, all) - defaults to all`,
  )
  .option(
    "-i, --interactive",
    "allow interactive re-authentication during usage fetch",
  )
  .addOption(
    new Option("-o, --format <format>", "Output format")
      .choices(["text", "json", "prometheus"])
      .default("text"),
  )
  .addHelpText(
    "after",
    `\nExamples:\n  # Query all services\n  ${packageJson.name} usage\n\n  # Query a single service\n  ${packageJson.name} usage --service claude\n\n  # Pipe Prometheus output into grep\n  ${packageJson.name} usage --format=prometheus | grep claude\n`,
  )
  .action(async (options: UsageCommandOptions) => {
    await usageCommand(options);
  });

// Auth command group
const auth = program
  .command("auth")
  .description("Manage authentication for services")
  .helpCommand(false)
  .addHelpText(
    "after",
    `\nStorage: ${getBrowserContextsDirectory()}\n(respects XDG_DATA_HOME and platform defaults)`,
  );

auth
  .command("setup")
  .description("Set up browser-based authentication for a service")
  .argument(
    "<service>",
    "Service to authenticate (claude, chatgpt, github-copilot)",
  )
  .action(async (service: string) => {
    await authSetupCommand({ service });
  });

auth
  .command("status")
  .description("Check authentication status for services")
  .option("-s, --service <service>", "Check status for specific service")
  .action((options: { readonly service?: string }) => {
    authStatusCommand(options);
  });

auth
  .command("clear")
  .description("Clear saved browser authentication for a service")
  .argument("<service>", "Service to clear (claude, chatgpt, github-copilot)")
  .action(async (service: string) => {
    await authClearCommand({ service });
  });

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (process.exitCode === undefined) process.exitCode = 1;
}
