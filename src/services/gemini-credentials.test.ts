import { describe, it, expect } from "vitest";
import {
  extractEmailFromIdToken,
  isTokenExpired,
  getSelectedAuthType,
  validateAuthType,
} from "./gemini-credentials.js";
import type { GeminiCredentials, GeminiSettings } from "../types/gemini.js";

describe("gemini credentials", () => {
  describe("extractEmailFromIdToken", () => {
    it("extracts email from valid JWT id_token", () => {
      // Create a mock JWT with email claim
      // Header: {"alg":"RS256","typ":"JWT"}
      // Payload: {"email":"test@example.com","sub":"123"}
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ email: "test@example.com", sub: "123" }),
      ).toString("base64url");
      const signature = "mock-signature";
      const token = `${header}.${payload}.${signature}`;

      const email = extractEmailFromIdToken(token);
      expect(email).toBe("test@example.com");
    });

    it("returns undefined for invalid JWT structure", () => {
      expect(extractEmailFromIdToken("invalid")).toBeUndefined();
      expect(extractEmailFromIdToken("only.two")).toBeUndefined();
    });

    it("returns undefined for malformed payload", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
        "base64url",
      );
      const payload = "not-valid-base64!@#$";
      const token = `${header}.${payload}.signature`;

      expect(extractEmailFromIdToken(token)).toBeUndefined();
    });

    it("returns undefined when email claim is missing", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
        "base64url",
      );
      const payload = Buffer.from(
        JSON.stringify({ sub: "123", name: "Test User" }),
      ).toString("base64url");
      const token = `${header}.${payload}.signature`;

      expect(extractEmailFromIdToken(token)).toBeUndefined();
    });

    it("handles base64url encoding with special characters", () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
        "base64url",
      );
      // Payload with characters that differ between base64 and base64url
      const payload = Buffer.from(
        JSON.stringify({ email: "user+test@example.com", data: ">>><<<" }),
      ).toString("base64url");
      const token = `${header}.${payload}.signature`;

      const email = extractEmailFromIdToken(token);
      expect(email).toBe("user+test@example.com");
    });
  });

  describe("isTokenExpired", () => {
    it("returns true when token is expired", () => {
      const credentials: GeminiCredentials = {
        access_token: "test",
        refresh_token: "test",
        expiry_date: Date.now() - 1000, // 1 second ago
      };

      expect(isTokenExpired(credentials)).toBe(true);
    });

    it("returns false when token is valid", () => {
      const credentials: GeminiCredentials = {
        access_token: "test",
        refresh_token: "test",
        expiry_date: Date.now() + 3_600_000, // 1 hour from now
      };

      expect(isTokenExpired(credentials)).toBe(false);
    });

    it("returns true when token expires within 60 second buffer", () => {
      const credentials: GeminiCredentials = {
        access_token: "test",
        refresh_token: "test",
        expiry_date: Date.now() + 30_000, // 30 seconds from now
      };

      expect(isTokenExpired(credentials)).toBe(true);
    });
  });

  describe("getSelectedAuthType", () => {
    it("returns auth type from settings", () => {
      const settings: GeminiSettings = {
        security: {
          auth: {
            selectedType: "oauth-personal",
          },
        },
      };

      expect(getSelectedAuthType(settings)).toBe("oauth-personal");
    });

    it("returns undefined for empty settings", () => {
      expect(getSelectedAuthType({})).toBeUndefined();
    });

    it("returns undefined when security is missing", () => {
      const settings: GeminiSettings = {};
      expect(getSelectedAuthType(settings)).toBeUndefined();
    });

    it("returns undefined when auth is missing", () => {
      const settings: GeminiSettings = {
        security: {},
      };
      expect(getSelectedAuthType(settings)).toBeUndefined();
    });
  });

  describe("validateAuthType", () => {
    it("returns ok for oauth-personal", () => {
      const result = validateAuthType("oauth-personal");
      expect(result.ok).toBe(true);
    });

    it("returns ok for undefined auth type", () => {
      const result = validateAuthType();
      expect(result.ok).toBe(true);
    });

    it("returns error for api-key auth type", () => {
      const result = validateAuthType("api-key");
      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("error");
      expect((result as { error: Error }).error.message).toContain(
        "API key auth not supported",
      );
    });

    it("returns error for vertex-ai auth type", () => {
      const result = validateAuthType("vertex-ai");
      expect(result.ok).toBe(false);
      expect(result).toHaveProperty("error");
      expect((result as { error: Error }).error.message).toContain(
        "Vertex AI auth not supported",
      );
    });

    it("returns ok for unknown auth types", () => {
      const result = validateAuthType("some-future-type");
      expect(result.ok).toBe(true);
    });
  });
});
