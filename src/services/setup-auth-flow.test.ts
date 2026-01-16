import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BrowserContext, Page } from "playwright";

const mockGetServiceAuthConfig = vi.hoisted(() => vi.fn());
const mockWaitForLogin = vi.hoisted(() => vi.fn());
const mockVerifySessionByFetching = vi.hoisted(() => vi.fn());
const mockWriteAtomicJson = vi.hoisted(() => vi.fn());

vi.mock("./service-auth-configs.js", () => ({
  getServiceAuthConfig: mockGetServiceAuthConfig,
}));

vi.mock("./wait-for-login.js", () => ({
  waitForLogin: mockWaitForLogin,
}));

vi.mock("./verify-session.js", () => ({
  verifySessionByFetching: mockVerifySessionByFetching,
}));

vi.mock("../utils/write-atomic-json.js", () => ({
  writeAtomicJson: mockWriteAtomicJson,
}));

import { setupAuthInContext } from "./setup-auth-flow.js";

describe("setupAuthInContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws with login outcome context when selectors are not confirmed", async () => {
    mockGetServiceAuthConfig.mockReturnValue({
      url: "https://example.com/login",
      waitForSelectors: ["#logged-in"],
    });
    mockWaitForLogin.mockResolvedValue("manual");

    const closeMock = vi.fn();
    const page = {
      goto: vi.fn(),
      evaluate: vi.fn().mockResolvedValue("agent"),
      close: closeMock,
    } as unknown as Page;
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      storageState: vi.fn().mockResolvedValue({}),
    } as unknown as BrowserContext;

    await expect(
      setupAuthInContext("github-copilot", context, "/tmp/state.json"),
    ).rejects.toThrowError(
      "Login was not confirmed after manual continuation. Authentication was not saved.",
    );
    expect(mockWriteAtomicJson).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });

  it("throws with verification outcome details when verification fails", async () => {
    mockGetServiceAuthConfig.mockReturnValue({
      url: "https://example.com/login",
      waitForSelectors: ["#logged-in"],
      verifyUrl: "https://example.com/verify",
    });
    mockWaitForLogin.mockResolvedValue("timeout");
    mockVerifySessionByFetching.mockResolvedValue(false);

    const closeMock = vi.fn();
    const page = {
      goto: vi.fn(),
      evaluate: vi.fn().mockResolvedValue("agent"),
      close: closeMock,
    } as unknown as Page;
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      storageState: vi.fn().mockResolvedValue({}),
    } as unknown as BrowserContext;

    await expect(
      setupAuthInContext("github-copilot", context, "/tmp/state.json"),
    ).rejects.toThrowError(
      "Unable to verify session via https://example.com/verify after login timeout. Authentication was not saved.",
    );
    expect(mockWriteAtomicJson).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });

  it("throws when authentication is canceled", async () => {
    mockGetServiceAuthConfig.mockReturnValue({
      url: "https://example.com/login",
      waitForSelectors: ["#logged-in"],
    });
    mockWaitForLogin.mockResolvedValue("aborted");

    const closeMock = vi.fn();
    const page = {
      goto: vi.fn(),
      evaluate: vi.fn().mockResolvedValue("agent"),
      close: closeMock,
    } as unknown as Page;
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      storageState: vi.fn().mockResolvedValue({}),
    } as unknown as BrowserContext;

    await expect(
      setupAuthInContext("github-copilot", context, "/tmp/state.json"),
    ).rejects.toThrowError(
      "Authentication was canceled. Authentication was not saved.",
    );
    expect(mockWriteAtomicJson).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
  });
});
