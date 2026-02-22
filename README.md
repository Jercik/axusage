# axusage

Monitor API usage across Claude, ChatGPT, GitHub Copilot, and Gemini from a single CLI.

## Quick Start

```bash
# Install globally
npm install -g axusage

# One-time authentication per provider
claude
codex
gemini
gh auth login

# Optional: print service-specific auth instructions
axusage --auth-setup copilot

# Check auth status
axusage --auth-status

# Fetch usage for all services
axusage
```

## Requirements

- `claude` CLI (Claude auth) - `npm install -g @anthropic-ai/claude-code`
- `codex` CLI (ChatGPT auth) - `npm install -g @openai/codex`
- `gemini` CLI (Gemini auth) - `npm install -g @google/gemini-cli`
- `gh` CLI (GitHub Copilot auth) - `https://cli.github.com/` or `brew install gh`

### Custom Paths

If CLIs are not on your `PATH`, override binary paths:

```bash
export AXUSAGE_CLAUDE_PATH=/path/to/claude
export AXUSAGE_CODEX_PATH=/path/to/codex
export AXUSAGE_GEMINI_PATH=/path/to/gemini
export AXUSAGE_GH_PATH=/path/to/gh

# Optional: dependency check timeout (milliseconds, default: 5000)
export AXUSAGE_CLI_TIMEOUT_MS=5000
```

`AXUSAGE_GH_PATH` is also used as a Copilot fallback when resolving a token
via `gh auth token`.

## Authentication

Authentication is managed by provider CLIs for all services.

- Claude: `claude`
- ChatGPT: `codex`
- Gemini: `gemini`
- GitHub Copilot: `gh auth login`

Use:

```bash
axusage --auth-setup <service>
```

to print the correct command for a given service.

Check auth status with:

```bash
axusage --auth-status
axusage --auth-status claude
```

`--auth-status` checks whether each service is authenticated and reports the
detected auth method. It does not validate API token freshness.

## Usage

```bash
# Query all services
axusage

# Query a single service
axusage --service claude
axusage -s codex
axusage -s copilot

# Output formats
axusage --format text
axusage --format tsv
axusage --format json
axusage --format prometheus

# Auth utilities
axusage --auth-setup claude
axusage --auth-status

# Disable color output
axusage --no-color
```

### Exit Codes

- `0`: Success
- `1`: One or more failures (including partial failures)

## Credential Sources

Credential source config is read from:

- Config file path shown in `axusage --help`
- `AXUSAGE_SOURCES` environment variable (JSON), which overrides file config

## Examples

### Extract service and utilization (TSV + awk)

```bash
axusage --format tsv | tail -n +2 | awk -F'\t' '{print $1, $4"%"}'
```

### Count windows by service (TSV + cut/sort/uniq)

```bash
axusage --format tsv | tail -n +2 | cut -f1 | sort | uniq -c
```

### Filter by utilization threshold (TSV + awk)

```bash
axusage --format tsv | tail -n +2 | awk -F'\t' '$4 > 50 {print $1, $3, $4"%"}'
```

### Extract utilization as JSON (JSON + jq)

```bash
axusage --format json \
  | jq -r '(.results? // .) | (if type=="array" then . else [.] end) | .[] | .windows[] | [.name, (.utilization|tostring)] | @tsv'
```

## Output

Human-readable output includes:

- Utilization percentage per window
- Usage rate vs expected rate
- Reset times
- Color coding: on track / over budget / significantly over

JSON output provides structured data for automation.
Prometheus output emits text metrics suitable for scraping.

## Serve Mode

`axusage serve` starts an HTTP server that exposes Prometheus metrics at `/metrics` for scraping, with automatic polling.

### Usage

```bash
# Start with defaults (port 3848, poll every 5 minutes)
axusage serve

# Custom configuration
axusage serve --port 9090 --interval 60 --service claude

# With environment variables
AXUSAGE_PORT=9090 AXUSAGE_INTERVAL=60 axusage serve
```

### Options

| Flag                   | Env Var            | Default     | Description                 |
| ---------------------- | ------------------ | ----------- | --------------------------- |
| `--port <port>`        | `AXUSAGE_PORT`     | `3848`      | Port to listen on           |
| `--host <host>`        | `AXUSAGE_HOST`     | `127.0.0.1` | Host to bind to             |
| `--interval <seconds>` | `AXUSAGE_INTERVAL` | `300`       | Polling interval in seconds |
| `--service <service>`  | `AXUSAGE_SERVICE`  | all         | Service to monitor          |

### Endpoints

- `GET /metrics` — Prometheus text exposition (`text/plain; version=0.0.4`). Returns 503 if no data has been fetched yet.
- `GET /health` — JSON health status with version, last refresh time, tracked services, and errors.

### Container Deployment

```bash
# Build image
podman build -t axusage .

# Run (configure credential sources via AXUSAGE_SOURCES)
podman run -p 3848:3848 --user 1000:1000 \
  -e AXUSAGE_SOURCES='{"claude":{"source":"vault","name":"claude-oauth"}}' \
  -e AXVAULT_URL=http://axvault:3847 \
  -e AXVAULT_API_KEY=axv_sk_... \
  axusage
```

### Docker Compose

```bash
cp .env.example .env
# Edit .env with credential sources and vault config
docker compose up -d --build
```

### Publishing

Container publishing is part of CI/CD:

- Pushes to `main` run the `Release` workflow.
- If `semantic-release` creates a new version tag, CI builds and publishes a multi-arch image to `registry.j4k.dev/axusage:<version>`.

For manual publishing:

```bash
./scripts/publish-image.sh --dry-run
./scripts/publish-image.sh --version 1.0.0
```

## Troubleshooting

### "Required dependency '... not found'"

Install the missing CLI or set the corresponding override env var (for example, `AXUSAGE_GH_PATH`).

### Authentication errors (401 / unauthorized / no saved authentication)

1. Run `axusage --auth-status` to see which services are not authenticated.
2. Re-authenticate in the provider CLI (`claude`, `codex`, `gemini`, `gh auth login`).
3. Retry `axusage`.

### Partial failures

`axusage` exits with code `1` if any service fails, even when other services succeed. Check warnings in stderr for the failed service(s).

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: `axusage` Usage

Run `npx -y axusage --help` to learn available options.

Use `axusage` when you need a quick, scriptable snapshot of API usage across Claude, ChatGPT, GitHub Copilot, and Gemini. It standardizes output (text, JSON, Prometheus) so you can alert, dashboard, or pipe it into other Unix tools.
```

## Development

For local development in this repository, `pnpm run start` triggers a clean rebuild before executing the CLI. Use `node bin/axusage` only when `dist/` is already up to date. End users installing globally should run the `axusage` binary directly.
