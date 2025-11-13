import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

const environmentPathsMock = vi.fn(() => ({ data: "/tmp/agent-usage" }));

vi.mock("env-paths", () => ({
  __esModule: true,
  default: environmentPathsMock,
}));

const loadModule = async (): Promise<typeof import("./app-paths.js")> => {
  vi.resetModules();
  return import("./app-paths.js");
};

describe("getBrowserContextsDirectory", () => {
  beforeEach(() => {
    environmentPathsMock.mockReset();
    environmentPathsMock.mockReturnValue({ data: "/tmp/agent-usage" });
  });

  it("joins the env-paths data directory with browser-contexts", async () => {
    const { getBrowserContextsDirectory } = await loadModule();
    expect(getBrowserContextsDirectory()).toBe(
      path.join("/tmp/agent-usage", "browser-contexts"),
    );
  });

  it("returns an absolute directory path", async () => {
    environmentPathsMock.mockReturnValue({
      data: path.resolve("relative-data"),
    });
    const { getBrowserContextsDirectory } = await loadModule();
    expect(path.isAbsolute(getBrowserContextsDirectory())).toBe(true);
  });

  it("initializes env-paths once with suffix disabled", async () => {
    await loadModule();
    expect(environmentPathsMock).toHaveBeenCalledTimes(1);
    expect(environmentPathsMock).toHaveBeenCalledWith("agent-usage", {
      suffix: "",
    });
  });
});
