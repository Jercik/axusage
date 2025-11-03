import { request } from "playwright";

/**
 * Fetch JSON using Playwright's APIRequestContext and a storage state file.
 * This bypasses page navigation and CORS, sending cookies from the saved state.
 */
export async function fetchJsonWithStorage(
  storageStatePath: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const api = await request.newContext({ storageState: storageStatePath });
  try {
    const response = await api.get(url, {
      headers: { Accept: "application/json, text/plain, */*", ...headers },
    });
    if (!response.ok()) {
      throw new Error(
        `Request failed: ${String(response.status())} ${response.statusText()}`,
      );
    }
    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, got ${contentType}`);
    }
    return await response.text();
  } finally {
    await api.dispose();
  }
}
