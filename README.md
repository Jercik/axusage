# Agent Usage CLI

Monitor AI usage across Claude, ChatGPT, and GitHub Copilot from a single command.

## Quick Start

```bash
# Install globally
npm install -g agent-usage

# Set up authentication (one-time setup per service)
claude
codex
gemini
agent-usage auth setup github-copilot

# Check authentication status
agent-usage auth status

# Fetch usage
agent-usage
```

## Authentication

Claude, ChatGPT, and Gemini use their respective CLI OAuth sessions. GitHub
Copilot uses browser-based authentication for persistent, long-lived sessions.

**Setup (one-time per service):**

```bash
# Set up authentication for each service
claude
codex
gemini
agent-usage auth setup github-copilot

# Check authentication status
agent-usage auth status
```

When you run `auth setup` for GitHub Copilot, a browser window will open.
Simply log in to GitHub as you normally would. Your authentication will be
saved and automatically used for future requests.

**Authenticated sessions directory (via [`env-paths`](https://github.com/sindresorhus/env-paths)):**

- Linux: `~/.local/share/agent-usage/browser-contexts/` (or `$XDG_DATA_HOME/agent-usage/browser-contexts/`)
- macOS: `~/Library/Application Support/agent-usage/browser-contexts/`
- Windows: `%LOCALAPPDATA%\agent-usage\Data\browser-contexts\`

You can override the location by providing `BrowserAuthConfig.dataDir`, but the CLI defaults to these platform-appropriate directories.

> **Migration note:** Releases before env-paths support stored sessions under `~/.agent-usage/browser-contexts/`. Upgrade by either rerunning `agent-usage auth setup <service>` or moving the old directory into the platform-specific path above (for example, `mv ~/.agent-usage/browser-contexts ~/.local/share/agent-usage/browser-contexts` on Linux).

Security notes:

- Files in this directory contain sensitive session data. They are created with owner-only permissions (0600 for files, 0700 for the directory) where possible.
- To revoke access for GitHub Copilot, clear saved browser auth:

```bash
agent-usage auth clear github-copilot
```

Browser installation:

- Playwright Chromium is installed automatically on `pnpm install` via a postinstall script. If this fails in your environment, install manually:

```bash
pnpm exec playwright install chromium --with-deps
```

**Global installation with pnpm:**

pnpm blocks postinstall scripts for global packages by default (npm runs them automatically). After installing globally, approve and run the postinstall script:

```bash
pnpm add -g agent-usage
pnpm approve-builds -g          # Select agent-usage when prompted
pnpm add -g agent-usage         # Reinstall to run postinstall
```

Alternatively, install the browser manually after global installation. Use the Playwright binary that ships with the global package so the browser is installed in the right location:

```bash
pnpm add -g agent-usage
PLAYWRIGHT_BIN="$(pnpm root -g)/agent-usage/node_modules/.bin/playwright"
"$PLAYWRIGHT_BIN" install chromium --with-deps
```

## Usage

```bash
# Query all services
agent-usage

# Allow interactive re-authentication during usage fetch
agent-usage --interactive

# Single service
agent-usage --service claude
agent-usage --service chatgpt
agent-usage --service github-copilot

# JSON output
agent-usage --format=json
agent-usage --service claude --format=json

```

## Examples

### Count services by availability (JSON + sort/uniq)

```bash
agent-usage --format=json \
  | jq -r '(.results? // .) | (if type=="array" then . else [.] end) | .[] | .service' \
  | sort | uniq -c
```

### Extract utilization windows as TSV (JSON + jq)

```bash
agent-usage --format=json \
  | jq -r '(.results? // .) | (if type=="array" then . else [.] end) | .[] | .windows[] | [.name, (.utilization|tostring)] | @tsv'
```

## Output

Human-readable format shows:

- Utilization percentage per window (5-hour, 7-day, monthly)
- Usage rate vs expected rate
- Reset times
- Color coding: 🟢 on track | 🟡 over budget | 🔴 significantly over

JSON format returns structured data for programmatic use.

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: `agent-usage` Usage

Run `npx -y agent-usage --help` to learn available options.

Use `agent-usage` when you need a quick, scriptable snapshot of API usage across Claude, ChatGPT, and GitHub Copilot. It standardizes output (text, JSON) so you can alert, dashboard, or pipe it into other Unix tools.
```

## Troubleshooting

### Authentication setup hangs

- The CLI shows a countdown while waiting for login.
- If you have completed login, press Enter in the terminal to continue.
- If it still fails, run `agent-usage auth clear <service>` and retry.

### "No saved authentication" error

- Check which services are authenticated: `agent-usage auth status`.
- Set up the missing service: `agent-usage auth setup <service>`.

### Sessions expire

- Browser sessions can expire based on provider policy. Re-run `auth setup` for the affected service when you see authentication errors.

## Remote authentication and Prometheus export

You can perform the interactive login flow on a workstation (for example, a local macOS laptop) and reuse the resulting browser session on a headless Linux server that collects usage and exports it for Prometheus.

### 1. Authenticate on a workstation

1. Install globally and authenticate the CLIs you need, then set up browser
   auth for GitHub Copilot:

   ```bash
   npm install -g agent-usage

   claude
   codex
   gemini
   agent-usage auth setup github-copilot
   ```

2. Confirm the workstation has valid sessions:

   ```bash
   agent-usage auth status
   ```

3. Package the saved contexts so they can be transferred. Set `CONTEXT_DIR` to the path for your platform (see the table above):

   ```bash
   CONTEXT_DIR="$HOME/.local/share/agent-usage/browser-contexts"  # Linux default; adjust on macOS/Windows
   tar czf agent-usage-contexts.tgz -C "$(dirname "$CONTEXT_DIR")" "$(basename "$CONTEXT_DIR")"
   ```

   Archive structure: `browser-contexts/claude/`, `browser-contexts/chatgpt/`, etc.

### 2. Transfer the browser contexts to the Linux server

1. Copy the archive to the server with `scp` (replace `user@server` with your login):

   ```bash
   scp agent-usage-contexts.tgz user@server:~/
   ```

2. On the server, create the target directory if it does not already exist, unpack the archive, and lock down the permissions:

   ```bash
   ssh user@server
   CONTEXT_DIR="$HOME/.local/share/agent-usage/browser-contexts"  # Linux default; adjust per platform
   AGENT_USAGE_DIR="$(dirname "$CONTEXT_DIR")"
   mkdir -p "$CONTEXT_DIR"
   tar xzf ~/agent-usage-contexts.tgz -C "$AGENT_USAGE_DIR"
   # Directories 700, files 600
   find "$AGENT_USAGE_DIR" -type d -exec chmod 700 {} +
   find "$CONTEXT_DIR" -type f -exec chmod 600 {} +
   ```

3. Verify that the sessions are available on the server:

   ```bash
   agent-usage auth status
   ```

   If the server does not yet have the tool installed, run `npm install -g agent-usage` before checking the status.

Notes:

- Use `--service <name>` to restrict services.
- Sessions may expire or become invalid if you change your password or log out of the service in another browser. Re-run `auth setup` as needed.
- If you transfer browser contexts between machines, ensure the target system is secure and permissions are restricted to the intended user.
- The CLI stores authentication data in the platform-specific directories listed above; protect that directory to prevent unauthorized access.

## Development

For local development in this repository, `pnpm run start` triggers a clean rebuild before executing the CLI. Use `pnpm run usage` only when `dist/` is already up to date. End users installing globally should run the `agent-usage` binary directly.
