import { describe, it, expect } from "vitest";
import { isAuthError } from "./run-auth-setup.js";

describe("isAuthError", () => {
  describe("should detect authentication errors", () => {
    it("detects 'authentication failed' message", () => {
      expect(isAuthError("Authentication failed")).toBe(true);
      expect(isAuthError("authentication failed")).toBe(true);
      expect(isAuthError("Error: Authentication failed for service")).toBe(
        true,
      );
    });

    it("detects 'no saved authentication' message", () => {
      expect(isAuthError("No saved authentication")).toBe(true);
      expect(isAuthError("Error: No saved authentication for claude")).toBe(
        true,
      );
    });

    it("detects HTTP 401 status code", () => {
      expect(isAuthError("HTTP 401")).toBe(true);
      expect(isAuthError("Error 401: Unauthorized")).toBe(true);
      expect(isAuthError("Request failed with status 401")).toBe(true);
    });

    it("detects 'unauthorized' message", () => {
      expect(isAuthError("Unauthorized")).toBe(true);
      expect(isAuthError("unauthorized access")).toBe(true);
      expect(isAuthError("Error: Unauthorized request")).toBe(true);
    });

    it("detects 'session expired' message", () => {
      expect(isAuthError("Session expired")).toBe(true);
      expect(isAuthError("Your session expired, please log in again")).toBe(
        true,
      );
    });

    it("detects 'login required' message", () => {
      expect(isAuthError("Login required")).toBe(true);
      expect(isAuthError("Error: login required to continue")).toBe(true);
    });
  });

  describe("should not detect false positives", () => {
    it("does not match partial words", () => {
      // "unauthorized" should not match "unauthorizeduser" (no word boundary)
      expect(isAuthError("unauthorizeduser")).toBe(false);
      // "401" should be a word boundary (numbers are word boundaries)
      expect(isAuthError("error4012")).toBe(false);
    });

    it("does not match unrelated errors", () => {
      expect(isAuthError("Network error")).toBe(false);
      expect(isAuthError("Connection timeout")).toBe(false);
      expect(isAuthError("Server error 500")).toBe(false);
      expect(isAuthError("Rate limit exceeded")).toBe(false);
      expect(isAuthError("Invalid response format")).toBe(false);
    });

    it("returns false for empty or generic messages", () => {
      expect(isAuthError("")).toBe(false);
      expect(isAuthError("Error")).toBe(false);
      expect(isAuthError("Something went wrong")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles mixed case correctly", () => {
      expect(isAuthError("UNAUTHORIZED")).toBe(true);
      expect(isAuthError("UnAutHoRiZeD")).toBe(true);
      expect(isAuthError("AUTHENTICATION FAILED")).toBe(true);
    });

    it("handles extra whitespace", () => {
      expect(isAuthError("authentication  failed")).toBe(true);
      expect(isAuthError("no   saved   authentication")).toBe(true);
    });
  });
});
