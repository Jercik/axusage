#!/usr/bin/env node

import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { usageCommand } from "./commands/usage-command.js";
import {
  authSetupCommand,
  authStatusCommand,
} from "./commands/auth-command.js";
import { getAvailableServices } from "./services/service-adapter-registry.js";

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

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
  .option("-j, --json", "Output raw JSON response")
  .option(
    "-w, --window <window>",
    "Show specific usage window (for filtering JSON output)",
  )
  .action(
    async (options: { service?: string; json?: boolean; window?: string }) => {
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
  .argument("<service>", "Service to authenticate (claude, chatgpt, github-copilot)")
  .action(async (service: string) => {
    await authSetupCommand({ service });
  });

auth
  .command("status")
  .description("Check authentication status for services")
  .option("-s, --service <service>", "Check status for specific service")
  .action(async (options: { service?: string }) => {
    await authStatusCommand(options);
  });

program.parse();
