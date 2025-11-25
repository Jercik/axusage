import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseSetCookie } from "./parse-set-cookie.js";

export interface Cookie {
  readonly name: string;
  readonly value: string;
  readonly domain?: string;
  readonly path?: string;
  readonly expires?: number;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: string;
}

interface StorageState {
  readonly cookies: readonly Cookie[];
  readonly origins?: readonly unknown[];
}

/**
 * Load cookies from a Playwright storage state file, filtered for Claude.ai domain.
 */
export async function loadClaudeCookies(
  cookiePath: string,
): Promise<readonly Cookie[]> {
  const content = await readFile(cookiePath, "utf8");
  const state: unknown = JSON.parse(content);
  if (
    typeof state !== "object" ||
    state === null ||
    !("cookies" in state) ||
    !Array.isArray(state.cookies)
  ) {
    throw new Error(`Invalid storage state format in ${cookiePath}`);
  }
  // Match ".claude.ai", "claude.ai", and legitimate subdomains like "api.claude.ai"
  // The regex ensures we only match domains ending with "claude.ai"
  const claudeDomainPattern = /^\.?([\w-]+\.)*claude\.ai$/iu;
  return (state.cookies as readonly Cookie[]).filter(
    (c) => c.domain !== undefined && claudeDomainPattern.test(c.domain),
  );
}

/**
 * Save cookies to a Playwright storage state file.
 */
export async function saveCookies(
  cookies: readonly Cookie[],
  cookiePath: string,
): Promise<void> {
  await mkdir(path.dirname(cookiePath), { recursive: true });
  const state: StorageState = { cookies, origins: [] };
  await writeFile(cookiePath, JSON.stringify(state, undefined, 2), {
    mode: 0o600,
  });
}

/**
 * Format cookies for the Cookie HTTP header.
 */
export function formatCookieHeader(cookies: readonly Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Parse Set-Cookie headers and merge with existing cookies.
 *
 * Note: Cookies are keyed by name only, not by the full (name, domain, path) tuple
 * per RFC 6265. Tested behavior shows Claude's API does not set duplicate cookie
 * names across different domains/paths, so name-only keying is sufficient here.
 */
export function mergeCookies(
  existing: readonly Cookie[],
  setCookieHeaders: readonly string[],
): Cookie[] {
  const cookieMap = new Map<string, Cookie>();

  for (const cookie of existing) {
    cookieMap.set(cookie.name, cookie);
  }

  for (const header of setCookieHeaders) {
    const cookie = parseSetCookie(header);
    if (cookie) {
      cookieMap.set(cookie.name, cookie);
    }
  }

  return [...cookieMap.values()];
}
