import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ApiError, ServiceUsageData } from "../types/domain.js";

type PrometheusLabelValue = string | number | boolean;

type PrometheusExporterInput = {
  readonly services: readonly string[];
  readonly successes: readonly ServiceUsageData[];
  readonly errors: readonly { service: string; error: ApiError }[];
  readonly now?: Date;
};

type PrometheusTextFileInput = PrometheusExporterInput & {
  readonly outputPath: string;
};

const escapeLabelValue = (value: string): string => {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\n/gu, "\\n")
    .replace(/"/gu, '\\"');
};

const formatLabels = (
  labels: Record<string, PrometheusLabelValue | undefined>,
): string => {
  const entries = Object.entries(labels).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return "";
  }

  const serialized = entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(",");

  return `{${serialized}}`;
};

const formatUtilizationRatio = (utilization: number): string => {
  const ratio = utilization / 100;
  return Number.isFinite(ratio) ? ratio.toString() : "NaN";
};

export const buildPrometheusTextFile = (
  input: PrometheusExporterInput,
): string => {
  const { services, successes, errors } = input;
  const timestamp = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const lines: string[] = [];

  lines.push(
    "# HELP agent_usage_last_scrape_timestamp_seconds Time when the agent-usage scrape completed.",
  );
  lines.push("# TYPE agent_usage_last_scrape_timestamp_seconds gauge");
  lines.push(`agent_usage_last_scrape_timestamp_seconds ${timestamp}`);

  const successesByService = new Map(
    successes.map((data) => [data.service.toLowerCase(), data]),
  );

  lines.push(
    "# HELP agent_usage_fetch_success Whether fetching usage for the service succeeded (1=true, 0=false).",
  );
  lines.push("# TYPE agent_usage_fetch_success gauge");
  for (const service of services) {
    const key = service.toLowerCase();
    const matchingData = successesByService.get(key);
    const labelService = matchingData?.service ?? key;
    const value = matchingData ? 1 : 0;
    lines.push(
      `agent_usage_fetch_success${formatLabels({ service: labelService })} ${value}`,
    );
  }

  if (successes.length > 0) {
    lines.push(
      "# HELP agent_usage_last_fetch_timestamp_seconds Time when usage data was last fetched successfully.",
    );
    lines.push("# TYPE agent_usage_last_fetch_timestamp_seconds gauge");
    for (const data of successes) {
      lines.push(
        `agent_usage_last_fetch_timestamp_seconds${formatLabels({ service: data.service })} ${timestamp}`,
      );
    }

    lines.push(
      "# HELP agent_usage_utilization_ratio Utilization ratio (0-1) for each quota window.",
    );
    lines.push("# TYPE agent_usage_utilization_ratio gauge");
    for (const data of successes) {
      for (const window of data.windows) {
        lines.push(
          `agent_usage_utilization_ratio${formatLabels({
            service: data.service,
            window: window.name,
            plan_type: data.planType,
          })} ${formatUtilizationRatio(window.utilization)}`,
        );
      }
    }

    lines.push(
      "# HELP agent_usage_window_resets_at_timestamp_seconds Time when the usage window resets.",
    );
    lines.push("# TYPE agent_usage_window_resets_at_timestamp_seconds gauge");
    for (const data of successes) {
      for (const window of data.windows) {
        const resetTimestamp = Math.floor(window.resetsAt.getTime() / 1000);
        lines.push(
          `agent_usage_window_resets_at_timestamp_seconds${formatLabels({
            service: data.service,
            window: window.name,
            plan_type: data.planType,
          })} ${resetTimestamp}`,
        );
      }
    }

    const hasAllowedMetadata = successes.some(
      (data) => data.metadata?.allowed !== undefined,
    );
    if (hasAllowedMetadata) {
      lines.push(
        "# HELP agent_usage_allowed Whether the account is currently allowed to make requests (1=true, 0=false).",
      );
      lines.push("# TYPE agent_usage_allowed gauge");
      for (const data of successes) {
        if (data.metadata?.allowed !== undefined) {
          lines.push(
            `agent_usage_allowed${formatLabels({
              service: data.service,
              plan_type: data.planType,
            })} ${data.metadata.allowed ? 1 : 0}`,
          );
        }
      }
    }

    const hasLimitMetadata = successes.some(
      (data) => data.metadata?.limitReached !== undefined,
    );
    if (hasLimitMetadata) {
      lines.push(
        "# HELP agent_usage_limit_reached Whether the usage limit has been reached (1=true, 0=false).",
      );
      lines.push("# TYPE agent_usage_limit_reached gauge");
      for (const data of successes) {
        if (data.metadata?.limitReached !== undefined) {
          lines.push(
            `agent_usage_limit_reached${formatLabels({
              service: data.service,
              plan_type: data.planType,
            })} ${data.metadata.limitReached ? 1 : 0}`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    lines.push(
      "# HELP agent_usage_fetch_failures_total Number of services that failed to return usage during the scrape.",
    );
    lines.push("# TYPE agent_usage_fetch_failures_total gauge");
    lines.push(`agent_usage_fetch_failures_total ${errors.length}`);
  }

  return `${lines.join("\n")}\n`;
};

export const writePrometheusTextFile = async (
  input: PrometheusTextFileInput,
): Promise<void> => {
  const { outputPath } = input;
  const contents = buildPrometheusTextFile(input);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents, "utf8");
};
