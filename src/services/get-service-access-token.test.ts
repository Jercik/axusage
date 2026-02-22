import {
  fetchVaultCredentials,
  getAgentAccessToken,
  isVaultConfigured,
} from "axauth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServiceSourceConfig } from "../config/credential-sources.js";

vi.mock("axauth", () => ({
  fetchVaultCredentials: vi.fn(),
  getAgentAccessToken: vi.fn(),
  isVaultConfigured: vi.fn(),
}));

vi.mock("../config/credential-sources.js", () => ({
  getServiceSourceConfig: vi.fn(),
}));

vi.mock("../utils/copilot-gh-token.js", () => ({
  getCopilotTokenFromCustomGhPath: vi.fn(),
}));

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

import { getCopilotTokenFromCustomGhPath } from "../utils/copilot-gh-token.js";
import { getServiceAccessToken } from "./get-service-access-token.js";

const mockFetchVaultCredentials = vi.mocked(fetchVaultCredentials);
const mockGetAgentAccessToken = vi.mocked(getAgentAccessToken);
const mockIsVaultConfigured = vi.mocked(isVaultConfigured);
const mockGetServiceSourceConfig = vi.mocked(getServiceSourceConfig);
const mockGetCopilotTokenFromCustomGhPath = vi.mocked(
  getCopilotTokenFromCustomGhPath,
);

describe("getServiceAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServiceSourceConfig.mockReturnValue({
      source: "local",
      name: "unused",
    });
    mockIsVaultConfigured.mockReturnValue(false);
    mockFetchVaultCredentials.mockResolvedValue({
      ok: false,
      reason: "not-configured",
    });
  });

  it("falls back to AXUSAGE_GH_PATH token for copilot", async () => {
    mockGetCopilotTokenFromCustomGhPath.mockReturnValue("ghu_custom_token");

    const token = await getServiceAccessToken("copilot");

    expect(mockGetAgentAccessToken).toHaveBeenCalledWith("copilot");
    expect(mockGetCopilotTokenFromCustomGhPath).toHaveBeenCalledTimes(1);
    expect(token).toBe("ghu_custom_token");
  });

  it("does not use custom gh fallback for non-copilot services", async () => {
    const token = await getServiceAccessToken("claude");

    expect(mockGetAgentAccessToken).toHaveBeenCalledWith("claude");
    expect(mockGetCopilotTokenFromCustomGhPath).not.toHaveBeenCalled();
    expect(token).toBeUndefined();
  });

  it("returns axauth token when available and skips fallback", async () => {
    mockGetAgentAccessToken.mockResolvedValue("primary_token");

    const token = await getServiceAccessToken("copilot");

    expect(mockGetAgentAccessToken).toHaveBeenCalledWith("copilot");
    expect(mockGetCopilotTokenFromCustomGhPath).not.toHaveBeenCalled();
    expect(token).toBe("primary_token");
  });

  it("uses fallback for copilot when local resolver throws", async () => {
    mockGetAgentAccessToken.mockRejectedValue(new Error("resolver failed"));
    mockGetCopilotTokenFromCustomGhPath.mockReturnValue("ghu_custom_token");

    const token = await getServiceAccessToken("copilot");

    expect(mockGetCopilotTokenFromCustomGhPath).toHaveBeenCalledTimes(1);
    expect(token).toBe("ghu_custom_token");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Local credential fetch error for copilot"),
    );
  });
});
