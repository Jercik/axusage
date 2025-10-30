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
 *
 * The FTA (Failure to Analyze) score is best reduced by extracting code into
 * separate files rather than making small optimizations within the same file.
 * This is because FTA combines file size, cyclomatic complexity, and Halstead
 * metrics - all of which are significantly impacted by file boundaries.
 *
 * Extracting functionality also creates opportunities to identify and reuse
 * common patterns across the codebase.
 */
function generateSuggestions(result: FtaResult): string[] {
  const suggestions: string[] = [];

  // Primary recommendation: extract to separate files (most effective)
  suggestions.push(
    "🎯 Extract functionality into separate files (most effective for reducing FTA)",
  );

  // Specific extraction suggestions based on metrics
  if (result.line_count > 100) {
    suggestions.push(
      "Identify reusable components/utilities that could be extracted and shared",
    );
  }

  if (result.cyclo > 10) {
    suggestions.push(
      `Extract complex conditional logic into dedicated modules (cyclomatic: ${result.cyclo.toString()})`,
    );
  }

  // File-specific guidance
  if (result.line_count > 300) {
    suggestions.push(
      "This file is too large - split into 3-4 focused modules by responsibility",
    );
  } else if (result.line_count > 200) {
    suggestions.push(
      "Consider splitting into 2-3 modules by feature or concern",
    );
  } else if (result.line_count > 100) {
    suggestions.push(
      "Look for groups of related functions to extract as modules",
    );
  }

  if (result.halstead.difficulty > 40) {
    suggestions.push(
      `Complex operations detected (difficulty: ${result.halstead.difficulty.toFixed(1)}) - extract into helper functions`,
    );
  }

  if (result.halstead.bugs > 1.0) {
    suggestions.push(
      `High bug probability (${result.halstead.bugs.toFixed(2)}) - split complex logic for better testing`,
    );
  }

  // Add note about ineffective approaches
  suggestions.push(
    "⚠️ Note: Small refactors within the file won't significantly reduce FTA",
  );

  return suggestions;
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
  console.log(
    "📋 KEY INSIGHT: The most effective way to reduce FTA scores is to EXTRACT functionality",
  );
  console.log(
    "   into separate files. This is an opportunity to identify reusable code that could",
  );
  console.log(
    "   benefit other parts of your codebase. Small optimizations within a file rarely",
  );
  console.log("   make a significant impact on the FTA score.\n");

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
