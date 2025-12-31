# axusage

Monitor AI usage across Claude, ChatGPT, GitHub Copilot, and Gemini from a single command.

## Quick Start

```bash
# Install globally
npm install -g axusage

# Set up authentication (one-time setup per service)
claude
codex
gemini
axusage auth setup github-copilot

# Check authentication status
axusage auth status

# Fetch usage
axusage
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
axusage auth setup github-copilot

# Check authentication status
axusage auth status
```

When you run `auth setup` for GitHub Copilot, a browser window will open.
Simply log in to GitHub as you normally would. Your authentication will be
saved and automatically used for future requests.

**Authenticated sessions directory (via [`env-paths`](https://github.com/sindresorhus/env-paths)):**

- Linux: `~/.local/share/axusage/browser-contexts/` (or `$XDG_DATA_HOME/axusage/browser-contexts/`)
- macOS: `~/Library/Application Support/axusage/browser-contexts/`
- Windows: `%LOCALAPPDATA%\axusage\Data\browser-contexts\`

You can override the location by providing `BrowserAuthConfig.dataDir`, but the CLI defaults to these platform-appropriate directories.

> **Migration from `agent-usage`:** If upgrading from the old `agent-usage` package, copy your authentication contexts:
>
> - Linux/macOS: `mkdir -p ~/.local/share/axusage/ && cp -r ~/.local/share/agent-usage/* ~/.local/share/axusage/`
> - Windows: Copy from `%LOCALAPPDATA%\agent-usage\` to `%LOCALAPPDATA%\axusage\`

Security notes:

- Files in this directory contain sensitive session data. They are created with owner-only permissions (0600 for files, 0700 for the directory) where possible.
- To revoke access for GitHub Copilot, clear saved browser auth:

```bash
axusage auth clear github-copilot
```

Browser installation:

- Playwright Chromium is installed automatically on `pnpm install` via a postinstall script. If this fails in your environment, install manually:

```bash
pnpm exec playwright install chromium --with-deps
```

**Global installation with pnpm:**

pnpm blocks postinstall scripts for global packages by default (npm runs them automatically). After installing globally, approve and run the postinstall script:

```bash
pnpm add -g axusage
pnpm approve-builds -g          # Select axusage when prompted
pnpm add -g axusage             # Reinstall to run postinstall
```

Alternatively, install the browser manually after global installation. Use the Playwright binary that ships with the global package so the browser is installed in the right location:

```bash
pnpm add -g axusage
PLAYWRIGHT_BIN="$(pnpm root -g)/axusage/node_modules/.bin/playwright"
"$PLAYWRIGHT_BIN" install chromium --with-deps
```

## Usage

```bash
# Query all services
axusage

# Allow interactive re-authentication during usage fetch
axusage --interactive

# Single service
axusage --service claude
axusage --service chatgpt
axusage --service github-copilot

# JSON output
axusage --format=json
axusage --service claude --format=json

# TSV output (parseable with cut, awk, sort)
axusage --format=tsv
```

## Examples

### Extract service and utilization (TSV + awk)

```bash
axusage --format=tsv | tail -n +2 | awk -F'\t' '{print $1, $4"%"}'
```

### Count windows by service (TSV + cut/sort/uniq)

```bash
axusage --format=tsv | tail -n +2 | cut -f1 | sort | uniq -c
```

### Filter by utilization threshold (TSV + awk)

```bash
axusage --format=tsv | tail -n +2 | awk -F'\t' '$4 > 50 {print $1, $3, $4"%"}'
```

### Extract utilization as JSON (JSON + jq)

```bash
axusage --format=json \
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
# Rule: `axusage` Usage

Run `npx -y axusage --help` to learn available options.

Use `axusage` when you need a quick, scriptable snapshot of API usage across Claude, ChatGPT, GitHub Copilot, and Gemini. It standardizes output (text, JSON, Prometheus) so you can alert, dashboard, or pipe it into other Unix tools.
```

## Troubleshooting

### Authentication setup hangs

- The CLI shows a countdown while waiting for login.
- If you have completed login, press Enter in the terminal to continue.
- If it still fails, run `axusage auth clear <service>` and retry.

### "No saved authentication" error

- Check which services are authenticated: `axusage auth status`.
- Set up the missing service: `axusage auth setup <service>`.

### Sessions expire

- Browser sessions can expire based on provider policy. Re-run `auth setup` for the affected service when you see authentication errors.

## Remote authentication and Prometheus export

You can perform the interactive login flow on a workstation (for example, a local macOS laptop) and reuse the resulting browser session on a headless Linux server that collects usage and exports it for Prometheus.

### 1. Authenticate on a workstation

1. Install globally and authenticate the CLIs you need, then set up browser
   auth for GitHub Copilot:

   ```bash
   npm install -g axusage

   claude
   codex
   gemini
   axusage auth setup github-copilot
   ```

2. Confirm the workstation has valid sessions:

   ```bash
   axusage auth status
   ```

3. Package the saved contexts so they can be transferred. Set `CONTEXT_DIR` to the path for your platform (see the table above):

   ```bash
   CONTEXT_DIR="$HOME/.local/share/axusage/browser-contexts"  # Linux default; adjust on macOS/Windows
   tar czf axusage-contexts.tgz -C "$(dirname "$CONTEXT_DIR")" "$(basename "$CONTEXT_DIR")"
   ```

   Archive structure: `browser-contexts/claude/`, `browser-contexts/chatgpt/`, etc.

### 2. Transfer the browser contexts to the Linux server

1. Copy the archive to the server with `scp` (replace `user@server` with your login):

   ```bash
   scp axusage-contexts.tgz user@server:~/
   ```

2. On the server, create the target directory if it does not already exist, unpack the archive, and lock down the permissions:

   ```bash
   ssh user@server
   CONTEXT_DIR="$HOME/.local/share/axusage/browser-contexts"  # Linux default; adjust per platform
   AXUSAGE_DIR="$(dirname "$CONTEXT_DIR")"
   mkdir -p "$CONTEXT_DIR"
   tar xzf ~/axusage-contexts.tgz -C "$AXUSAGE_DIR"
   # Directories 700, files 600
   find "$AXUSAGE_DIR" -type d -exec chmod 700 {} +
   find "$CONTEXT_DIR" -type f -exec chmod 600 {} +
   ```

3. Verify that the sessions are available on the server:

   ```bash
   axusage auth status
   ```

   If the server does not yet have the tool installed, run `npm install -g axusage` before checking the status.

Notes:

- Use `--service <name>` to restrict services.
- Sessions may expire or become invalid if you change your password or log out of the service in another browser. Re-run `auth setup` as needed.
- If you transfer browser contexts between machines, ensure the target system is secure and permissions are restricted to the intended user.
- The CLI stores authentication data in the platform-specific directories listed above; protect that directory to prevent unauthorized access.

## Development

For local development in this repository, `pnpm run start` triggers a clean rebuild before executing the CLI. Use `pnpm run usage` only when `dist/` is already up to date. End users installing globally should run the `axusage` binary directly.
