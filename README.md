# Agent Usage CLI

Monitor AI usage across Claude, ChatGPT, and GitHub Copilot from a single command.

## Quick Start

```bash
pnpm install
pnpm run build

# Set up authentication (recommended - one-time setup)
node bin/agent-usage auth setup claude
node bin/agent-usage auth setup chatgpt
node bin/agent-usage auth setup github-copilot

# Check authentication status
node bin/agent-usage auth status

# Fetch usage
node bin/agent-usage
```

## Authentication

This tool supports two authentication methods:

### 1. Browser-Based Authentication (Recommended)

Browser-based auth provides persistent, long-lived sessions without manual token extraction.

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

### 2. Manual Token Authentication (Alternative)

If you prefer to manage tokens manually, you can still provide them via environment variables or CLI flags.

#### Claude

1. Go to [Anthropic Console](https://console.anthropic.com/) → API settings
2. Copy your OAuth access token (starts with `sk-ant-`)
3. Add to `.env` as `CLAUDE_ACCESS_TOKEN`

#### ChatGPT

1. Open [ChatGPT](https://chatgpt.com) → DevTools (F12) → Network tab
2. Find any `backend-api/*` request → Request Headers
3. Copy the JWT token portion from the `Authorization` header (the string after `Bearer `, starts with `eyJ`, ~1000 chars)
   - Right-click → "Copy value" to avoid truncation, then remove the leading `Bearer ` prefix
4. Add to `.env` as `CHATGPT_ACCESS_TOKEN`

#### GitHub Copilot

1. Sign in to GitHub.com → DevTools (F12) → Application/Storage → Cookies
2. Copy the `user_session` cookie value (~48 chars, NOT `_gh_sess`)
3. Add to `.env` as `GITHUB_COPILOT_SESSION_TOKEN`

**Note:** Manual tokens may expire frequently, requiring re-extraction from the browser. Browser-based auth solves this problem with persistent sessions.

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

# Override token
node bin/agent-usage --service claude --token "your_token"
```

> ℹ️ `pnpm run start` triggers a clean rebuild before executing the CLI. The shorter `pnpm run usage` script skips the rebuild step and is intended only when `dist/` is already up to date.

## Output

Human-readable format shows:

- Utilization percentage per window (5-hour, 7-day, monthly)
- Usage rate vs expected rate
- Reset times
- Color coding: 🟢 on track | 🟡 over budget | 🔴 significantly over

JSON format returns structured data for programmatic use.
