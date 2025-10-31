import { execSync } from "node:child_process";
import type { FtaResult } from "../fta-types.js";

export function parseThreshold(arguments_: string[]): number {
  const argument = arguments_.find((a) => a.startsWith("--threshold"));
  if (!argument) return 50;
  // Handle cases where '=' or value is missing
  if (argument === "--threshold" || argument.endsWith("=")) {
    throw new Error(
      "--threshold requires a non-empty value (e.g., --threshold=50)",
    );
  }
  const [, value = ""] = argument.split("=");
  if (value.trim() === "") {
    throw new Error(
      "--threshold requires a non-empty value (e.g., --threshold=50)",
    );
  }
  const threshold = Number(value);
  if (Number.isNaN(threshold) || threshold <= 0) {
    throw new Error("--threshold must be a positive number");
  }
  return threshold;
}

type ExecSyncError = Error & {
  status?: number;
  stdout?: Buffer | string;
  stderr?: Buffer | string;
};

export function getViolations(threshold: number): FtaResult[] {
  try {
    const output = execSync("pnpm --silent fta", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return (JSON.parse(output) as FtaResult[]).filter(
      (r) => r.fta_score > threshold,
    );
  } catch (error_) {
    const error = error_ as ExecSyncError;
    if (typeof error.status === "number" && error.stderr) {
      const stderrText = Buffer.isBuffer(error.stderr)
        ? error.stderr.toString()
        : error.stderr;
      throw new Error(
        `FTA CLI failed with exit code ${String(error.status)}: ${stderrText}`,
      );
    }
    throw new Error(`Failed to execute FTA CLI: ${String(error_)}`);
  }
}

// Reporting helpers moved to fta-report.ts
