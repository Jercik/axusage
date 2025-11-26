import type { Cookie } from "./cookie-storage.js";

/**
 * Parse a Set-Cookie header into a Cookie object.
 */
export function parseSetCookie(header: string): Cookie | undefined {
  const parts = header.split(";");
  const nameValue = parts[0];
  if (!nameValue) return undefined;

  const equalsIndex = nameValue.indexOf("=");
  if (equalsIndex === -1) return undefined;

  const name = nameValue.slice(0, equalsIndex).trim();
  if (name.length === 0) return undefined;
  const value = nameValue.slice(equalsIndex + 1).trim();

  const cookie: {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    sameSite: string;
    httpOnly?: boolean;
    expires?: number;
  } = {
    name,
    value,
    domain: ".claude.ai",
    path: "/",
    secure: true,
    sameSite: "Lax",
  };

  let expiresFromExpires: number | undefined;
  let expiresFromMaxAge: number | undefined;

  for (let index = 1; index < parts.length; index++) {
    const rawAttribute = parts[index]?.trim() ?? "";
    const attribute = rawAttribute.toLowerCase();
    if (attribute === "httponly") {
      cookie.httpOnly = true;
    } else if (attribute === "secure") {
      cookie.secure = true;
    } else if (attribute.startsWith("samesite=")) {
      cookie.sameSite = rawAttribute.slice(9);
    } else if (attribute.startsWith("expires=")) {
      const date = new Date(rawAttribute.slice(8));
      if (!Number.isNaN(date.getTime())) {
        expiresFromExpires = date.getTime() / 1000;
      }
    } else if (attribute.startsWith("max-age=")) {
      // Explicit base 10 avoids ambiguity if the value is prefixed with a zero.
      // eslint-disable-next-line radix
      const maxAge = Number.parseInt(rawAttribute.slice(8), 10);
      if (!Number.isNaN(maxAge)) {
        expiresFromMaxAge = Date.now() / 1000 + maxAge;
      }
    } else if (attribute.startsWith("domain=")) {
      cookie.domain = rawAttribute.slice(7);
    } else if (attribute.startsWith("path=")) {
      cookie.path = rawAttribute.slice(5);
    }
  }

  if (expiresFromMaxAge !== undefined) {
    cookie.expires = expiresFromMaxAge;
  } else if (expiresFromExpires !== undefined) {
    cookie.expires = expiresFromExpires;
  }

  return cookie;
}
