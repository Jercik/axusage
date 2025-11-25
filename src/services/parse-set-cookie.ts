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

  for (let index = 1; index < parts.length; index++) {
    const attribute = parts[index]?.trim().toLowerCase() ?? "";
    if (attribute === "httponly") {
      cookie.httpOnly = true;
    } else if (attribute === "secure") {
      cookie.secure = true;
    } else if (attribute.startsWith("samesite=")) {
      cookie.sameSite = parts[index]?.trim().slice(9) ?? "";
    } else if (attribute.startsWith("expires=")) {
      const date = new Date(parts[index]?.trim().slice(8) ?? "");
      if (!Number.isNaN(date.getTime())) {
        cookie.expires = date.getTime() / 1000;
      }
    } else if (attribute.startsWith("max-age=")) {
      const maxAge = Number.parseInt(attribute.slice(8));
      if (!Number.isNaN(maxAge)) {
        cookie.expires = Date.now() / 1000 + maxAge;
      }
    } else if (attribute.startsWith("domain=")) {
      cookie.domain = parts[index]?.trim().slice(7) ?? "";
    } else if (attribute.startsWith("path=")) {
      cookie.path = parts[index]?.trim().slice(5) ?? "";
    }
  }

  return cookie;
}
