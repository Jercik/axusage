#!/usr/bin/env node

import { Command, Option } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { usageCommand } from "./commands/usage-command.js";
import { authSetupCommand } from "./commands/auth-setup-command.js";
import { authStatusCommand } from "./commands/auth-status-command.js";
import { authClearCommand } from "./commands/auth-clear-command.js";
import { getAvailableServices } from "./services/service-adapter-registry.js";
import { installAuthManagerCleanup } from "./services/shared-browser-auth-manager.js";

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

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
  .addOption(
    new Option("-o, --format <format>", "Output format")
      .choices(["text", "json", "prometheus"])
      .default("text"),
  )
  .action(
    async (options: {
      service?: string;
      format?: "text" | "json" | "prometheus";
    }) => {
      await usageCommand(options);
    },
  );

// Auth command group
const auth = program
  .command("auth")
  .description("Manage authentication for services");

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
  .action((options: { service?: string }) => {
    authStatusCommand(options);
  });

auth
  .command("clear")
  .description("Clear saved browser authentication for a service")
  .argument("<service>", "Service to clear (claude, chatgpt, github-copilot)")
  .action(async (service: string) => {
    await authClearCommand({ service });
  });

program.parse();
