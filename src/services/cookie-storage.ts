import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

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
  const state = JSON.parse(content) as StorageState;
  return state.cookies.filter(
    (c) =>
      c.domain === ".claude.ai" ||
      c.domain === "claude.ai" ||
      c.domain?.endsWith("claude.ai"),
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
    const parts = header.split(";")[0];
    if (!parts) continue;
    const equalsIndex = parts.indexOf("=");
    if (equalsIndex === -1) continue;

    const name = parts.slice(0, equalsIndex).trim();
    const value = parts.slice(equalsIndex + 1).trim();

    cookieMap.set(name, {
      name,
      value,
      domain: ".claude.ai",
      path: "/",
      secure: true,
      sameSite: "Lax",
    });
  }

  return [...cookieMap.values()];
}
