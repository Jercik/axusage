import { execSync } from "node:child_process";
import type { FtaResult } from "../fta-types.js";

export function parseThreshold(args: string[]): number {
  const arg = args.find((a) => a.startsWith("--threshold="));
  if (!arg) return 50;
  const [, value = ""] = arg.split("=");
  // Check for missing or empty value ("--threshold=" yields empty string)
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
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return (JSON.parse(output) as FtaResult[]).filter(
      (r) => r.fta_score > threshold,
    );
  } catch (error) {
    const e = error as ExecSyncError;
    if (typeof e.status === "number" && e.stderr) {
      const stderrText = Buffer.isBuffer(e.stderr)
        ? e.stderr.toString()
        : e.stderr;
      throw new Error(
        `FTA CLI failed with exit code ${String(e.status)}: ${stderrText}`,
      );
    }
    throw new Error(`Failed to execute FTA CLI: ${String(error)}`);
  }
}

// Reporting helpers moved to fta-report.ts
