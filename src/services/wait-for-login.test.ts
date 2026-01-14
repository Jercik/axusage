import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";

const mockInput = vi.hoisted(() => vi.fn());
const TimeoutError = vi.hoisted(() => class TimeoutError extends Error {});

vi.mock("@inquirer/prompts", () => ({
  input: mockInput,
}));

vi.mock("playwright", () => ({
  errors: { TimeoutError },
}));

import { waitForLogin } from "./wait-for-login.js";

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;
const originalStderrIsTTY = process.stderr.isTTY;

function setTtyState(stdin: boolean, stdout: boolean, stderr: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: stdin,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdout,
    configurable: true,
  });
  Object.defineProperty(process.stderr, "isTTY", {
    value: stderr,
    configurable: true,
  });
}

describe("waitForLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTtyState(false, false, false);
  });

  afterEach(() => {
    setTtyState(originalStdinIsTTY, originalStdoutIsTTY, originalStderrIsTTY);
  });

  it("returns skipped when no selectors and no prompt", async () => {
    const page = { waitForSelector: vi.fn() } as unknown as Page;

    await expect(waitForLogin(page, [])).resolves.toBe("skipped");
  });

  it("returns manual when prompt resolves", async () => {
    setTtyState(true, true, false);
    mockInput.mockResolvedValue("");
    const page = { waitForSelector: vi.fn() } as unknown as Page;

    await expect(waitForLogin(page, [])).resolves.toBe("manual");
  });

  it("returns manual when prompt is aborted", async () => {
    setTtyState(true, true, false);
    const error = new Error("aborted");
    error.name = "AbortPromptError";
    mockInput.mockRejectedValue(error);
    const page = { waitForSelector: vi.fn() } as unknown as Page;

    await expect(waitForLogin(page, [])).resolves.toBe("manual");
  });

  it("returns selector when a selector resolves", async () => {
    const page = {
      waitForSelector: vi.fn().mockResolvedValue({}),
    } as unknown as Page;

    await expect(waitForLogin(page, ["#logged-in"])).resolves.toBe("selector");
  });

  it("returns timeout when selectors time out", async () => {
    const page = {
      waitForSelector: vi.fn().mockRejectedValue(new TimeoutError("timeout")),
    } as unknown as Page;

    await expect(waitForLogin(page, ["#logged-in"])).resolves.toBe("timeout");
  });

  it("returns closed when selectors fail with closed errors", async () => {
    const page = {
      waitForSelector: vi.fn().mockRejectedValue(new Error("Target closed")),
    } as unknown as Page;

    await expect(waitForLogin(page, ["#logged-in"])).resolves.toBe("closed");
  });
});
