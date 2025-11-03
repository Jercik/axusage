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

## Remote authentication and Prometheus export

You can perform the interactive login flow on a workstation (for example, a local macOS laptop) and reuse the resulting browser session on a headless Linux server that collects usage and exports it for Prometheus.

### 1. Authenticate locally on macOS

1. Install dependencies and run the normal `auth setup` flow for every service you need:

   ```bash
   pnpm install
   pnpm run build

   node bin/agent-usage auth setup claude
   node bin/agent-usage auth setup chatgpt
   node bin/agent-usage auth setup github-copilot
   ```

2. Confirm the workstation has valid sessions:

   ```bash
   node bin/agent-usage auth status
   ```

3. Package the saved contexts so they can be transferred. The sessions live under `~/.agent-usage/browser-contexts/`:

   ```bash
   tar czf agent-usage-contexts.tgz -C "$HOME/.agent-usage" browser-contexts
   ```

### 2. Transfer the browser contexts to the Linux server

1. Copy the archive to the server with `scp` (replace `user@server` with your login):

   ```bash
   scp agent-usage-contexts.tgz user@server:/tmp/
   ```

2. On the server, create the target directory if it does not already exist, unpack the archive, and lock down the permissions:

   ```bash
   ssh user@server
   mkdir -p ~/.agent-usage
   tar xzf /tmp/agent-usage-contexts.tgz -C ~/.agent-usage
   chmod 700 ~/.agent-usage
   find ~/.agent-usage/browser-contexts -type d -exec chmod 700 {} +
   find ~/.agent-usage/browser-contexts -type f -exec chmod 600 {} +
   ```

3. Verify that the sessions are available on the server:

   ```bash
   node bin/agent-usage auth status
   ```

   If the server does not yet have the project installed, clone or deploy the same commit as the workstation and run `pnpm install` followed by `pnpm run build` before checking the status.

### 3. Export metrics for Prometheus

The CLI can emit JSON, which can be converted into Prometheus textfile metrics (compatible with `node_exporter --collector.textfile.directory`). The example below runs the CLI, emits gauges per service/window, and writes them to `/var/lib/node_exporter/textfile_collector/agent_usage.prom`.

1. Install `jq` on the server (`sudo apt install jq`, `brew install jq`, etc.).

2. Save the following script as `/opt/agent-usage/export-agent-usage-metrics.sh` (adjust paths as needed) and make it executable (`chmod +x`):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   REPO_DIR="/opt/agent-usage"
   TEXTFILE_DIR="/var/lib/node_exporter/textfile_collector"

   cd "$REPO_DIR"

   # Capture usage as JSON; surface failures to systemd/cron via the exit code
   usage_json=$(node bin/agent-usage --json)

   tmp_file=$(mktemp)
   {
     echo "# HELP agent_usage_utilization_percent Current utilization percentage by service/window"
     echo "# TYPE agent_usage_utilization_percent gauge"
     echo "$usage_json" | jq -r '
       (.results // .)
       | (if type == "array" then . else [.] end)
       | .[]
       | .service as $service
       | .windows[]
       | "agent_usage_utilization_percent{service=\"\($service)\",window=\"\(.name)\"} \(.utilization)"
     '
   } >"$tmp_file"

   mv "$tmp_file" "$TEXTFILE_DIR/agent_usage.prom"
   ```

   The script writes a complete file on every run so Prometheus never sees partial metrics. When any service fails, the CLI exits non-zero and the script stops before overwriting the previous metrics file.

3. Schedule the exporter (cron example, runs every 15 minutes):

   ```cron
   */15 * * * * /opt/agent-usage/export-agent-usage-metrics.sh
   ```

   For systemd timers, point the service unit to the same script. Ensure the unit has the necessary permissions to read `~/.agent-usage/browser-contexts` and write to the textfile directory.

4. Confirm that Prometheus is scraping the new metric name `agent_usage_utilization_percent` with the labels `service` and `window`.
