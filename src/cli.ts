#!/usr/bin/env node

import { config } from "dotenv";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { usageCommand } from "#commands/usage";
import { getAvailableServices } from "#services/registry";

// Load environment variables from .env file
config();

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

program
  .command("usage", { isDefault: true })
  .description(
    "Fetch API usage statistics (defaults to all: Claude, ChatGPT, GitHub Copilot)",
  )
  .option(
    "-s, --service <service>",
    `Service to query (${getAvailableServices().join(", ")}, all) - defaults to all`,
  )
  .option("-t, --token <token>", "Access token (overrides env var)")
  .option("-j, --json", "Output raw JSON response")
  .option(
    "-w, --window <window>",
    "Show specific usage window (for filtering JSON output)",
  )
  .action(
    async (options: {
      service?: string;
      token?: string;
      json?: boolean;
      window?: string;
    }) => {
      await usageCommand(options);
    },
  );

program.parse();
