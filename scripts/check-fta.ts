#!/usr/bin/env node

import { execSync } from "node:child_process";
import type { FtaResult } from "./types.js";

/**
 * Parse threshold from command line arguments
 */
function parseThreshold(args: string[]): number {
  const arg = args.find((a) => a.startsWith("--threshold="));
  if (!arg) return 50;

  const value = arg.split("=")[1];
  if (!value)
    throw new Error("--threshold requires a value (e.g., --threshold=50)");

  const threshold = Number(value);
  if (Number.isNaN(threshold) || threshold <= 0) {
    throw new Error("--threshold must be a positive number");
  }

  return threshold;
}

/**
 * Execute FTA CLI and return violations above threshold
 */
function getViolations(threshold: number): FtaResult[] {
  try {
    const output = execSync("pnpm --silent fta", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return (JSON.parse(output) as FtaResult[]).filter(
      (r) => r.fta_score > threshold,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "status" in error &&
      "stderr" in error &&
      typeof error.status === "number" &&
      error.stderr instanceof Buffer
    ) {
      throw new Error(
        `FTA CLI failed with exit code ${error.status.toString()}: ${error.stderr.toString()}`,
      );
    }

    throw new Error(`Failed to execute FTA CLI: ${String(error)}`);
  }
}

/**
 * Generate improvement suggestions based on metrics
 */
function generateSuggestions(result: FtaResult): string[] {
  const suggestions: string[] = [];

  if (result.cyclo > 15) {
    suggestions.push(
      `Reduce number of logical paths (cyclomatic complexity: ${result.cyclo.toString()})`,
    );
  } else if (result.cyclo > 10) {
    suggestions.push("Consider simplifying conditional logic");
  }

  if (result.line_count > 300) {
    suggestions.push("Break down into smaller, focused files");
  } else if (result.line_count > 200) {
    suggestions.push("Consider splitting into multiple files");
  } else if (result.line_count > 100) {
    suggestions.push("Extract complex logic into separate functions");
  }

  if (result.halstead.difficulty > 40) {
    suggestions.push(
      "Simplify operator and operand usage (high difficulty score)",
    );
  }

  if (result.halstead.bugs > 1.0) {
    suggestions.push(
      `Estimated ${result.halstead.bugs.toFixed(2)} bugs - review code carefully`,
    );
  }

  return suggestions.length > 0
    ? suggestions
    : [
        "Break down into smaller, focused functions",
        "Extract complex logic into separate files",
      ];
}

/**
 * Format a single violation for output
 */
function formatViolation(result: FtaResult): string {
  const h = result.halstead;
  const suggestions = generateSuggestions(result)
    .map((s) => `   - ${s}`)
    .join("\n");

  return `
❌ ${result.file_name}
   FTA Score: ${result.fta_score.toFixed(2)} (${result.assessment})
   Lines: ${result.line_count.toString()} | Cyclomatic Complexity: ${result.cyclo.toString()}

   Halstead Metrics:
   - Unique operators: ${h.uniq_operators.toString()} | Unique operands: ${h.uniq_operands.toString()}
   - Total operators: ${h.total_operators.toString()} | Total operands: ${h.total_operands.toString()}
   - Volume: ${h.volume.toFixed(2)} | Difficulty: ${h.difficulty.toFixed(2)}
   - Estimated bugs: ${h.bugs.toFixed(2)}

   💡 How to improve:
${suggestions}
`.trim();
}

/**
 * Format and print the complete report
 */
function printReport(violations: FtaResult[], threshold: number): void {
  console.log(
    "\nThe code was statically analyzed and several complexity issues were found:\n",
  );
  console.log(`FTA Score Violations (threshold: ${threshold.toString()})\n`);
  console.log(
    "The FTA score combines Halstead complexity, cyclomatic complexity, and lines of code",
  );
  console.log(
    "to measure maintainability. Higher scores indicate files that are more difficult to maintain.\n",
  );

  violations.forEach((v, i) => {
    console.log(formatViolation(v));
    if (i < violations.length - 1) console.log();
  });

  console.log(
    `\nFound ${violations.length.toString()} file(s) exceeding threshold of ${threshold.toString()}`,
  );
}

/**
 * Main entry point
 */
function main(): number {
  try {
    const threshold = parseThreshold(process.argv.slice(2));
    const violations = getViolations(threshold);

    if (violations.length === 0) {
      console.log(
        `✅ All files pass FTA threshold check (threshold: ${threshold.toString()})`,
      );
      return 0;
    }

    printReport(violations, threshold);
    return 1;
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

// Execute and exit with appropriate code
process.exit(main());
