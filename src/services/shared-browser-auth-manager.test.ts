import { describe, it, expect, vi, beforeEach } from "vitest";

const closeSpy = vi.fn(async () => {});

vi.mock("./browser-auth-manager.js", () => {
  return {
    BrowserAuthManager: class {
      close = closeSpy;
    },
  };
});

import {
  acquireAuthManager,
  releaseAuthManager,
} from "./shared-browser-auth-manager.js";

describe("shared-browser-auth-manager", () => {
  beforeEach(() => {
    closeSpy.mockClear();
  });

  it("reuses single instance and closes on final release", async () => {
    const a = acquireAuthManager();
    const b = acquireAuthManager();
    expect(a).toBe(b);

    await releaseAuthManager();
    expect(closeSpy).not.toHaveBeenCalled();

    await releaseAuthManager();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
