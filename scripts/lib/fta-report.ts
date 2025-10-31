import type { FtaResult } from "../fta-types.js";

function getCrossMark(): string {
  const flag = (process.env.NO_EMOJI || "").toLowerCase();
  if (flag === "1" || flag === "true") return "X";
  return "❌";
}

export function generateSuggestions(result: FtaResult): string[] {
  const suggestions: string[] = [
    "🎯 Extract functionality into separate files (most effective for reducing FTA)",
  ];
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
  if (result.halstead.bugs > 1) {
    suggestions.push(
      `High bug probability (${result.halstead.bugs.toFixed(2)}) - split complex logic for better testing`,
    );
  }
  suggestions.push(
    "⚠️ Note: Small refactors within the file won't significantly reduce FTA",
  );
  return suggestions;
}

export function formatViolation(result: FtaResult): string {
  const h = result.halstead;
  const suggestions = generateSuggestions(result)
    .map((s) => `   - ${s}`)
    .join("\n");
  return `
${getCrossMark()} ${result.file_name}
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

export function printReport(violations: FtaResult[], threshold: number): void {
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

  for (const [index, v] of violations.entries()) {
    console.log(formatViolation(v));
    if (index < violations.length - 1) console.log();
  }

  console.log(
    `\nFound ${violations.length.toString()} file(s) exceeding threshold of ${threshold.toString()}`,
  );
}
