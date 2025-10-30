#!/usr/bin/env node

import { parseThreshold, getViolations } from "./lib/fta-check.ts";
import { printReport } from "./lib/fta-report.ts";

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
