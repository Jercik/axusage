# Agent Usage CLI

Monitor AI usage across Claude, ChatGPT, and GitHub Copilot from a single command.

## Quick Start

```bash
pnpm install
cp .env.example .env
# Add your tokens to .env (see below)
pnpm run build
node bin/agent-usage
```

## Getting Access Tokens

### Claude

1. Go to [Anthropic Console](https://console.anthropic.com/) → API settings
2. Copy your OAuth access token (starts with `sk-ant-`)
3. Add to `.env` as `CLAUDE_ACCESS_TOKEN`

### ChatGPT

1. Open [ChatGPT](https://chatgpt.com) → DevTools (F12) → Network tab
2. Find any `backend-api/*` request → Request Headers
3. Copy the JWT token portion from the `Authorization` header (the string after `Bearer `, starts with `eyJ`, ~1000 chars)
   - Right-click → "Copy value" to avoid truncation, then remove the leading `Bearer ` prefix
4. Add to `.env` as `CHATGPT_ACCESS_TOKEN`

### GitHub Copilot

1. Sign in to GitHub.com → DevTools (F12) → Application/Storage → Cookies
2. Copy the `user_session` cookie value (~48 chars, NOT `_gh_sess`)
3. Add to `.env` as `GITHUB_COPILOT_SESSION_TOKEN`

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
