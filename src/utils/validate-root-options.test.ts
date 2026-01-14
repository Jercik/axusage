import { describe, expect, it } from "vitest";
import { getRootOptionsError } from "./validate-root-options.js";

describe("getRootOptionsError", () => {
  it("rejects multiple auth selections", () => {
    const message = getRootOptionsError({
      authSetup: "claude",
      authStatus: true,
    });

    expect(message).toBe(
      "Use only one of --auth-setup, --auth-status, or --auth-clear.",
    );
  });

  it("rejects --force without --auth-clear", () => {
    const message = getRootOptionsError({
      force: true,
    });

    expect(message).toBe("--force is only supported with --auth-clear.");
  });

  it("rejects auth operations combined with usage options", () => {
    const message = getRootOptionsError(
      {
        authStatus: true,
      },
      "cli",
    );

    expect(message).toBe(
      "Usage options cannot be combined with auth operations.",
    );
  });

  it("allows usage options when no auth operation is selected", () => {
    const message = getRootOptionsError({ service: "claude" }, "cli");

    expect(message).toBeUndefined();
  });
});
