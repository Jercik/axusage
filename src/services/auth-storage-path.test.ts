import { describe, it, expect } from "vitest";
import {
  getStorageStatePathFor,
  getAuthMetaPathFor,
} from "./auth-storage-path.js";

describe("auth storage paths", () => {
  it("builds storage state path per service", () => {
    expect(getStorageStatePathFor("/tmp/data", "claude")).toMatch(
      /\/tmp\/data\/claude-auth\.json$/u,
    );
    expect(getStorageStatePathFor("/tmp/data", "chatgpt")).toMatch(
      /\/tmp\/data\/chatgpt-auth\.json$/u,
    );
    expect(getStorageStatePathFor("/tmp/data", "github-copilot")).toMatch(
      /\/tmp\/data\/github-copilot-auth\.json$/u,
    );
  });

  it("builds meta path per service", () => {
    expect(getAuthMetaPathFor("/tmp/data", "claude")).toMatch(
      /\/tmp\/data\/claude-auth\.meta\.json$/u,
    );
    expect(getAuthMetaPathFor("/tmp/data", "chatgpt")).toMatch(
      /\/tmp\/data\/chatgpt-auth\.meta\.json$/u,
    );
    expect(getAuthMetaPathFor("/tmp/data", "github-copilot")).toMatch(
      /\/tmp\/data\/github-copilot-auth\.meta\.json$/u,
    );
  });
});
