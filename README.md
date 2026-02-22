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

# Check auth dependencies
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

Check auth dependencies with:

```bash
axusage --auth-status
axusage --auth-status claude
```

`--auth-status` verifies CLI availability and path. It does not validate token freshness; run the provider CLI to verify login state.

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

## Troubleshooting

### "Required dependency '... not found'"

Install the missing CLI or set the corresponding override env var (for example, `AXUSAGE_GH_PATH`).

### Authentication errors (401 / unauthorized / no saved authentication)

1. Run `axusage --auth-status` to see which CLI dependency is missing.
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
