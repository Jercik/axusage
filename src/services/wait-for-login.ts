import { errors, type Page } from "playwright";
import { LOGIN_TIMEOUT_MS } from "./auth-timeouts.js";
import { input } from "@inquirer/prompts";

/**
 * Waits until one of the selectors appears on the page, or the user presses Enter to continue.
 */
export type LoginWaitOutcome =
  | "selector"
  | "manual"
  | "timeout"
  | "closed"
  | "aborted"
  | "skipped";

function isTimeoutError(error: unknown): boolean {
  return error instanceof errors.TimeoutError;
}

const SELECTOR_CLOSED_MESSAGES = [
  "target closed",
  "page closed",
  "context closed",
  "execution context was destroyed",
] as const;

function isSelectorClosedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return SELECTOR_CLOSED_MESSAGES.some((snippet) => message.includes(snippet));
}

function classifySelectorFailure(
  error: unknown,
): Exclude<LoginWaitOutcome, "selector" | "manual" | "skipped"> | undefined {
  if (isTimeoutError(error)) return "timeout";
  if (isSelectorClosedError(error)) return "closed";
  return undefined;
}

function classifySelectorAggregate(
  error: unknown,
): Exclude<LoginWaitOutcome, "selector" | "manual" | "skipped"> | undefined {
  if (error instanceof AggregateError) {
    const outcomes = error.errors.map((item) => classifySelectorFailure(item));
    if (outcomes.every((item) => item === "timeout")) return "timeout";
    if (
      outcomes.every((item) => item === "timeout" || item === "closed") &&
      outcomes.includes("closed")
    ) {
      return "closed";
    }
    return undefined;
  }
  return classifySelectorFailure(error);
}

export async function waitForLogin(
  page: Page,
  selectors: readonly string[],
): Promise<LoginWaitOutcome> {
  const timeoutMs = LOGIN_TIMEOUT_MS;
  const canPrompt = process.stdin.isTTY && process.stdout.isTTY;
  // Non-TTY sessions rely solely on selector waits (no manual continuation).
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
          if (
            error instanceof Error &&
            (error.name === "AbortPromptError" || error.name === "AbortError")
          ) {
            // Expected when we cancel the prompt after a selector wins.
            // Returning "manual" keeps the promise resolved for the race.
            return "manual" as const;
          }
          if (error instanceof Error && error.name === "ExitPromptError") {
            return "aborted" as const;
          }
          throw error;
        })
    : undefined;
  if (shouldShowCountdown) {
    const deadline = Date.now() + timeoutMs;
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
              // Promise.any only rejects once all selectors have settled.
              const outcome = classifySelectorAggregate(error);
              if (outcome) return outcome;
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
