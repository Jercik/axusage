# Debian 12 Prometheus exporter service

This directory provides a systemd service and timer that run `agent-usage` on a schedule and write Prometheus-compatible metrics to a textfile collector directory. The units are intended for Debian 12 but should work on any recent systemd-based distribution with minimal adjustments.

## Prerequisites

- Node.js 20.x and pnpm available for the `agent-usage` user
- A checkout of this repository (for example `/opt/agent-usage`) with production dependencies installed via `pnpm install` and built once with `pnpm run build`
- Completed browser authentication for each provider using the interactive CLI (`node bin/agent-usage auth setup <service>`)
- A Prometheus node_exporter instance with the [textfile collector](https://prometheus.io/docs/guides/node-exporter/#textfile-collector) enabled

## Installation steps

1. Create a dedicated system user and group:

   ```bash
   sudo useradd --system --home /opt/agent-usage --shell /usr/sbin/nologin agent-usage
   ```

2. Clone the repository and install dependencies:

   ```bash
   sudo git clone <repository-url> /opt/agent-usage
   cd /opt/agent-usage
   sudo chown -R agent-usage:agent-usage .
   sudo -u agent-usage pnpm install --frozen-lockfile
   sudo -u agent-usage pnpm run build
   ```

3. Configure authentication for each service while logged in as the `agent-usage` user (these commands spawn a browser window):

   ```bash
   sudo -u agent-usage node bin/agent-usage auth setup claude
   sudo -u agent-usage node bin/agent-usage auth setup chatgpt
   sudo -u agent-usage node bin/agent-usage auth setup github-copilot
   ```

4. Copy the example environment file and adjust paths as needed. At minimum set `AGENT_USAGE_DIR` to the repository path and `AGENT_USAGE_PROMETHEUS_TEXTFILE` to a location readable by node_exporter.

   ```bash
   sudo install -o root -g root -m 0644 ops/debian12/agent-usage-prometheus.env /etc/default/agent-usage-prometheus
   sudo editor /etc/default/agent-usage-prometheus
   ```

5. Ensure the textfile collector directory exists and is writable by `agent-usage`:

   ```bash
   source /etc/default/agent-usage-prometheus
   sudo install -o agent-usage -g agent-usage -d "$(dirname "${AGENT_USAGE_PROMETHEUS_TEXTFILE}")"
   ```

6. Install the systemd units:

   ```bash
   sudo install -o root -g root -m 0755 ops/debian12/agent-usage-prometheus.sh /opt/agent-usage/ops/debian12/agent-usage-prometheus.sh
   sudo install -o root -g root -m 0644 ops/debian12/agent-usage-prometheus.service /etc/systemd/system/agent-usage-prometheus.service
   sudo install -o root -g root -m 0644 ops/debian12/agent-usage-prometheus.timer /etc/systemd/system/agent-usage-prometheus.timer
   sudo systemctl daemon-reload
   sudo systemctl enable --now agent-usage-prometheus.timer
   ```

7. Verify the exporter:

   ```bash
   systemctl status agent-usage-prometheus.service
   sudo -u agent-usage ls -l /var/lib/node_exporter/textfile_collector/agent_usage.prom
   ```

The timer runs the exporter hourly with a randomized delay to avoid thundering herds. Adjust `OnUnitActiveSec` and `RandomizedDelaySec` in the timer unit to suit your needs. You can trigger an ad-hoc run with:

```bash
sudo systemctl start agent-usage-prometheus.service
```

## Collected metrics

The exporter writes a text file containing gauges with the following names:

- `agent_usage_fetch_success{service="..."}` — 1 when the service responded successfully, otherwise 0
- `agent_usage_last_fetch_timestamp_seconds{service="..."}` — Unix timestamp for the most recent successful fetch
- `agent_usage_utilization_ratio{service="...",window="..."}` — utilization ratio (0–1) for each quota window
- `agent_usage_window_resets_at_timestamp_seconds{service="...",window="..."}` — reset timestamp for each quota window
- `agent_usage_allowed{service="..."}` — optional, present when the provider exposes an “allowed” flag
- `agent_usage_limit_reached{service="..."}` — optional, present when the provider exposes a “limit reached” flag
- `agent_usage_fetch_failures_total` — number of services that failed during the scrape
- `agent_usage_last_scrape_timestamp_seconds` — timestamp of the exporter run

Use the metrics to build alerts or dashboards that track utilization across Claude, ChatGPT, and GitHub Copilot from a single Prometheus scrape.
