# Agent Usage CLI

Monitor AI usage across Claude, ChatGPT, and GitHub Copilot from a single command.

## Quick Start

```bash
pnpm install  # Downloads Playwright Chromium (~300MB) automatically
pnpm run build

# Set up authentication (one-time setup per service)
node bin/agent-usage auth setup claude
node bin/agent-usage auth setup chatgpt
node bin/agent-usage auth setup github-copilot

# Check authentication status
node bin/agent-usage auth status

# Fetch usage
node bin/agent-usage
```

## Authentication

This tool uses browser-based authentication for persistent, long-lived sessions.

**Setup (one-time per service):**

```bash
# Set up authentication for each service
node bin/agent-usage auth setup claude
node bin/agent-usage auth setup chatgpt
node bin/agent-usage auth setup github-copilot

# Check authentication status
node bin/agent-usage auth status
```

When you run `auth setup`, a browser window will open. Simply log in to the service as you normally would. Your authentication will be saved and automatically used for future requests.

**Authenticated sessions are stored in:** `~/.agent-usage/browser-contexts/`

Security notes:

- Files in this directory contain sensitive session data. They are created with owner-only permissions (0600 for files, 0700 for the directory) where possible.
- To revoke access, clear saved auth per service:

```bash
node bin/agent-usage auth clear claude
node bin/agent-usage auth clear chatgpt
node bin/agent-usage auth clear github-copilot
```

Browser installation:

- Playwright Chromium is installed automatically on `pnpm install` via a postinstall script. If this fails in your environment, install manually:

```bash
pnpm exec playwright install chromium --with-deps
```

## Usage

```bash
# Query all services
node bin/agent-usage

# Single service
node bin/agent-usage --service claude
node bin/agent-usage --service chatgpt
node bin/agent-usage --service github-copilot

# JSON output
node bin/agent-usage --json
node bin/agent-usage --service claude --json
```

> ℹ️ `pnpm run start` triggers a clean rebuild before executing the CLI. The shorter `pnpm run usage` script skips the rebuild step and is intended only when `dist/` is already up to date.

## Prometheus metrics

The CLI can export usage data as Prometheus [textfile collector](https://prometheus.io/docs/guides/node-exporter/#textfile-collector) metrics for ingestion by node_exporter or other compatible agents.

```bash
node bin/agent-usage usage --prometheus-textfile /var/lib/node_exporter/textfile_collector/agent_usage.prom
```

When the option is supplied the scrape status for every requested service is recorded, even if some of them fail. The file is recreated on every run, so ensure the target directory is writable by the user running the command.

Packaged systemd units and automation scripts for Debian 12 can be found in [`ops/debian12`](ops/debian12/README.md).

## Output

Human-readable format shows:

- Utilization percentage per window (5-hour, 7-day, monthly)
- Usage rate vs expected rate
- Reset times
- Color coding: 🟢 on track | 🟡 over budget | 🔴 significantly over

JSON format returns structured data for programmatic use.

## Troubleshooting

### Authentication setup hangs

- The CLI shows a countdown while waiting for login.
- If you have completed login, press Enter in the terminal to continue.
- If it still fails, run `node bin/agent-usage auth clear <service>` and retry.

### "No saved authentication" error

- Check which services are authenticated: `node bin/agent-usage auth status`.
- Set up the missing service: `node bin/agent-usage auth setup <service>`.

### Sessions expire

- Browser sessions can expire based on provider policy. Re-run `auth setup` for the affected service when you see authentication errors.
