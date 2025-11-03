#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DEBUG:-}" ]]; then
  set -x
fi

: "${AGENT_USAGE_DIR:?AGENT_USAGE_DIR must be set (e.g. /opt/agent-usage)}"
: "${AGENT_USAGE_PROMETHEUS_TEXTFILE:?AGENT_USAGE_PROMETHEUS_TEXTFILE must be set (e.g. /var/lib/node_exporter/textfile_collector/agent_usage.prom)}"

cd "${AGENT_USAGE_DIR}"

mkdir -p "$(dirname "${AGENT_USAGE_PROMETHEUS_TEXTFILE}")"

exec node ./bin/agent-usage usage --prometheus-textfile "${AGENT_USAGE_PROMETHEUS_TEXTFILE}"
