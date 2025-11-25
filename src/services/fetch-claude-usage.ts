import {
  type Cookie,
  loadClaudeCookies,
  saveCookies,
  formatCookieHeader,
  mergeCookies,
} from "./cookie-storage.js";

/**
 * Make an HTTP request to Claude's API with session cookies.
 */
async function fetchWithCookies(
  url: string,
  cookies: readonly Cookie[],
): Promise<{ data: unknown; setCookies: readonly string[] }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Cookie: formatCookieHeader(cookies),
      // Intentionally truncated User-Agent to avoid Cloudflare bot detection.
      // Full Chrome UA triggers 403 errors; this minimal version works reliably.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Authentication failed (${String(response.status)}). Run 'agent-usage auth setup claude' to re-authenticate.`,
      );
    }
    throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const setCookies = response.headers.getSetCookie();

  return { data, setCookies };
}

/**
 * Fetch the organization ID from Claude's API.
 */
async function fetchOrganizationId(
  cookies: readonly Cookie[],
): Promise<{ orgId: string; setCookies: readonly string[] }> {
  const { data, setCookies } = await fetchWithCookies(
    "https://claude.ai/api/organizations",
    cookies,
  );

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No organizations found");
  }

  const org: unknown = data[0];
  if (
    typeof org !== "object" ||
    org === null ||
    !("uuid" in org) ||
    typeof org.uuid !== "string"
  ) {
    throw new Error("Invalid organization response format");
  }

  return { orgId: org.uuid, setCookies };
}

/**
 * Fetch Claude usage data using saved session cookies.
 *
 * @param cookiePath - Path to the Playwright storage state file
 * @returns JSON string containing the usage data
 * @throws Error if fetch fails or authentication is required
 */
export async function fetchClaudeUsage(cookiePath: string): Promise<string> {
  const cookies = await loadClaudeCookies(cookiePath);

  if (cookies.length === 0) {
    throw new Error(
      "No saved session found. Run 'agent-usage auth setup claude' first.",
    );
  }

  const allSetCookies: string[] = [];

  const { orgId, setCookies: orgSetCookies } =
    await fetchOrganizationId(cookies);
  allSetCookies.push(...orgSetCookies);

  // Use merged cookies in case the org endpoint refreshed session tokens
  const cookiesForUsage = mergeCookies(cookies, orgSetCookies);
  const { data, setCookies: usageSetCookies } = await fetchWithCookies(
    `https://claude.ai/api/organizations/${orgId}/usage`,
    cookiesForUsage,
  );
  allSetCookies.push(...usageSetCookies);

  const finalCookies = mergeCookies(cookies, allSetCookies);
  await saveCookies(finalCookies, cookiePath);

  return JSON.stringify(data);
}
