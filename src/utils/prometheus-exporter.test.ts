import { describe, expect, it } from "vitest";

import { ApiError } from "../types/domain.js";
import type { ServiceUsageData } from "../types/domain.js";
import { buildPrometheusTextFile } from "./prometheus-exporter.js";

const createUsageWindow = (
  name: string,
  utilization: number,
  resetsAt: Date,
  periodDurationMs: number,
): ServiceUsageData["windows"][number] => ({
  name,
  utilization,
  resetsAt,
  periodDurationMs,
});

const createUsageData = (
  service: string,
  windows: ServiceUsageData["windows"],
  planType?: string,
  metadata?: ServiceUsageData["metadata"],
): ServiceUsageData => ({
  service,
  windows,
  planType,
  metadata,
});

const createError = (
  service: string,
): { service: string; error: ApiError } => ({
  service,
  error: new ApiError(`Failed to fetch ${service}`),
});

describe("buildPrometheusTextFile", () => {
  it("serializes successful usage data with metadata", () => {
    const now = new Date("2024-05-24T00:00:00Z");
    const data = [
      createUsageData(
        "claude",
        [
          createUsageWindow(
            "monthly",
            25,
            new Date("2024-06-01T00:00:00Z"),
            2_592_000_000,
          ),
          createUsageWindow(
            "7-day",
            50,
            new Date("2024-05-27T00:00:00Z"),
            604_800_000,
          ),
        ],
        "team",
        { allowed: true, limitReached: false },
      ),
    ];

    const output = buildPrometheusTextFile({
      services: ["claude"],
      successes: data,
      errors: [],
      now,
    });

    expect(output).toMatchInlineSnapshot(`
"# HELP agent_usage_last_scrape_timestamp_seconds Time when the agent-usage scrape completed.\n# TYPE agent_usage_last_scrape_timestamp_seconds gauge\nagent_usage_last_scrape_timestamp_seconds 1716508800\n# HELP agent_usage_fetch_success Whether fetching usage for the service succeeded (1=true, 0=false).\n# TYPE agent_usage_fetch_success gauge\nagent_usage_fetch_success{service=\"claude\"} 1\n# HELP agent_usage_last_fetch_timestamp_seconds Time when usage data was last fetched successfully.\n# TYPE agent_usage_last_fetch_timestamp_seconds gauge\nagent_usage_last_fetch_timestamp_seconds{service=\"claude\"} 1716508800\n# HELP agent_usage_utilization_ratio Utilization ratio (0-1) for each quota window.\n# TYPE agent_usage_utilization_ratio gauge\nagent_usage_utilization_ratio{service=\"claude\",window=\"monthly\",plan_type=\"team\"} 0.25\nagent_usage_utilization_ratio{service=\"claude\",window=\"7-day\",plan_type=\"team\"} 0.5\n# HELP agent_usage_window_resets_at_timestamp_seconds Time when the usage window resets.\n# TYPE agent_usage_window_resets_at_timestamp_seconds gauge\nagent_usage_window_resets_at_timestamp_seconds{service=\"claude\",window=\"monthly\",plan_type=\"team\"} 1717200000\nagent_usage_window_resets_at_timestamp_seconds{service=\"claude\",window=\"7-day\",plan_type=\"team\"} 1716768000\n# HELP agent_usage_allowed Whether the account is currently allowed to make requests (1=true, 0=false).\n# TYPE agent_usage_allowed gauge\nagent_usage_allowed{service=\"claude\",plan_type=\"team\"} 1\n# HELP agent_usage_limit_reached Whether the usage limit has been reached (1=true, 0=false).\n# TYPE agent_usage_limit_reached gauge\nagent_usage_limit_reached{service=\"claude\",plan_type=\"team\"} 0\n"
    `);
  });

  it("includes failed services and omits optional metadata when absent", () => {
    const now = new Date("2024-05-24T12:00:00Z");
    const successes = [
      createUsageData("chatgpt", [
        createUsageWindow(
          "5-hour",
          10,
          new Date("2024-05-24T17:00:00Z"),
          18_000_000,
        ),
      ]),
    ];
    const errors = [createError("claude"), createError("github-copilot")];

    const output = buildPrometheusTextFile({
      services: ["claude", "chatgpt", "github-copilot"],
      successes,
      errors,
      now,
    });

    expect(output).toMatchInlineSnapshot(`
      "# HELP agent_usage_last_scrape_timestamp_seconds Time when the agent-usage scrape completed.
      # TYPE agent_usage_last_scrape_timestamp_seconds gauge
      agent_usage_last_scrape_timestamp_seconds 1716552000
      # HELP agent_usage_fetch_success Whether fetching usage for the service succeeded (1=true, 0=false).
      # TYPE agent_usage_fetch_success gauge
      agent_usage_fetch_success{service="claude"} 0
      agent_usage_fetch_success{service="chatgpt"} 1
      agent_usage_fetch_success{service="github-copilot"} 0
      # HELP agent_usage_last_fetch_timestamp_seconds Time when usage data was last fetched successfully.
      # TYPE agent_usage_last_fetch_timestamp_seconds gauge
      agent_usage_last_fetch_timestamp_seconds{service="chatgpt"} 1716552000
      # HELP agent_usage_utilization_ratio Utilization ratio (0-1) for each quota window.
      # TYPE agent_usage_utilization_ratio gauge
      agent_usage_utilization_ratio{service="chatgpt",window="5-hour"} 0.1
      # HELP agent_usage_window_resets_at_timestamp_seconds Time when the usage window resets.
      # TYPE agent_usage_window_resets_at_timestamp_seconds gauge
      agent_usage_window_resets_at_timestamp_seconds{service="chatgpt",window="5-hour"} 1716570000
      # HELP agent_usage_fetch_failures_total Number of services that failed to return usage during the scrape.
      # TYPE agent_usage_fetch_failures_total gauge
      agent_usage_fetch_failures_total 2
      "
    `);
  });
});
