import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePromptCapability } from "./resolve-prompt-capability.js";

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

function setTtyState(stdin: boolean, stdout: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", {
    value: stdin,
    configurable: true,
  });
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdout,
    configurable: true,
  });
}

describe("resolvePromptCapability", () => {
  beforeEach(() => {
    setTtyState(true, true);
  });

  afterEach(() => {
    setTtyState(originalStdinIsTTY, originalStdoutIsTTY);
  });

  it("returns true when both stdin and stdout are TTYs", () => {
    setTtyState(true, true);
    expect(resolvePromptCapability()).toBe(true);
  });

  it("returns false when stdin is not a TTY", () => {
    setTtyState(false, true);
    expect(resolvePromptCapability()).toBe(false);
  });

  it("returns false when stdout is not a TTY", () => {
    setTtyState(true, false);
    expect(resolvePromptCapability()).toBe(false);
  });
});
