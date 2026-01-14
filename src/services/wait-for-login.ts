import type { Page } from "playwright";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";
import { input } from "@inquirer/prompts";

/**
 * Waits until one of the selectors appears on the page, or the user presses Enter to continue.
 */
export type LoginWaitOutcome = "selector" | "manual" | "timeout" | "skipped";

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function isTimeoutAggregate(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.every((item) => isTimeoutError(item));
  }
  return isTimeoutError(error);
}

export async function waitForLogin(
  page: Page,
  selectors: readonly string[],
): Promise<LoginWaitOutcome> {
  const timeoutMs = LOGIN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const canPrompt = process.stdin.isTTY && process.stdout.isTTY;
  if (!canPrompt && selectors.length === 0) {
    return "skipped";
  }
  const waiters = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout: timeoutMs }),
  );
  const shouldShowCountdown = process.stderr.isTTY && waiters.length > 0;
  let interval: NodeJS.Timeout | undefined;
  const manualController = canPrompt ? new AbortController() : undefined;
  const manualPromise = manualController
    ? input(
        {
          message: "Press Enter to continue without waiting for login...",
          default: "",
        },
        { signal: manualController.signal },
      )
        .then(() => "manual" as const)
        .catch((error) => {
          if (error instanceof Error && error.name === "AbortPromptError") {
            return "manual" as const;
          }
          throw error;
        })
    : undefined;
  if (shouldShowCountdown) {
    interval = setInterval(() => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        // Stop logging once timeout elapses to avoid confusing "0 minute(s)" spam
        if (interval) clearInterval(interval);
        console.error("Login wait timed out; finishing up...");
        return;
      }
      // Round up to the next minute for clearer UX, ensure at least 1
      const minutes = Math.max(1, Math.ceil(remaining / 60_000));
      console.error(
        `Still waiting for login... ${String(minutes)} minute(s) remaining`,
      );
    }, 60_000);
  }
  try {
    const selectorPromise =
      waiters.length > 0
        ? Promise.any(waiters)
            .then(() => "selector" as const)
            .catch((error) => {
              if (isTimeoutAggregate(error)) return "timeout" as const;
              throw error;
            })
        : undefined;
    const raceTargets: Array<Promise<LoginWaitOutcome>> = [];
    if (manualPromise) raceTargets.push(manualPromise);
    if (selectorPromise) raceTargets.push(selectorPromise);
    if (raceTargets.length === 0) return "skipped";
    return await Promise.race(raceTargets);
  } finally {
    if (interval) clearInterval(interval);
    manualController?.abort();
  }
}
