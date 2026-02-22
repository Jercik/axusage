import { describe, it, expect } from "vitest";
import { formatRequiresSection } from "./format-requires-help-text.js";
import type { RuntimeRequirement } from "./format-requires-help-text.js";

describe("formatRequiresSection", () => {
  it("renders single compact line when all requirements are ok", () => {
    const requirements: RuntimeRequirement[] = [
      { label: "claude", status: "ok", fix: undefined },
      { label: "codex (ChatGPT)", status: "ok", fix: undefined },
      { label: "gemini", status: "ok", fix: undefined },
      { label: "gh (Copilot)", status: "ok", fix: undefined },
    ];

    expect(formatRequiresSection(requirements)).toBe(
      "Requires: claude, codex (ChatGPT), gemini, gh (Copilot)",
    );
  });

  it("renders multi-line with MISSING tag when a CLI is not found", () => {
    const requirements: RuntimeRequirement[] = [
      { label: "claude", status: "ok", fix: undefined },
      {
        label: "codex (ChatGPT)",
        status: "missing",
        fix: "Install: npm install -g @openai/codex. Or set AXUSAGE_CODEX_PATH=/path/to/codex",
      },
      { label: "gemini", status: "ok", fix: undefined },
      { label: "gh (Copilot)", status: "ok", fix: undefined },
    ];

    expect(formatRequiresSection(requirements)).toBe(
      "Requires:\n" +
        "  - claude\n" +
        "  - codex (ChatGPT) - MISSING! Install: npm install -g @openai/codex. Or set AXUSAGE_CODEX_PATH=/path/to/codex\n" +
        "  - gemini\n" +
        "  - gh (Copilot)",
    );
  });

  it("renders multi-line with NOT AUTHORIZED tag for auth failures", () => {
    const requirements: RuntimeRequirement[] = [
      { label: "claude", status: "not-authorized", fix: "Run: claude" },
      { label: "codex (ChatGPT)", status: "ok", fix: undefined },
      { label: "gemini", status: "ok", fix: undefined },
      { label: "gh (Copilot)", status: "ok", fix: undefined },
    ];

    expect(formatRequiresSection(requirements)).toBe(
      "Requires:\n" +
        "  - claude - NOT AUTHORIZED! Run: claude\n" +
        "  - codex (ChatGPT)\n" +
        "  - gemini\n" +
        "  - gh (Copilot)",
    );
  });

  it("handles mixed statuses", () => {
    const requirements: RuntimeRequirement[] = [
      { label: "claude", status: "ok", fix: undefined },
      {
        label: "codex (ChatGPT)",
        status: "missing",
        fix: "Install: npm install -g @openai/codex",
      },
      { label: "gemini", status: "not-authorized", fix: "Run: gemini" },
      { label: "gh (Copilot)", status: "ok", fix: undefined },
    ];

    expect(formatRequiresSection(requirements)).toBe(
      "Requires:\n" +
        "  - claude\n" +
        "  - codex (ChatGPT) - MISSING! Install: npm install -g @openai/codex\n" +
        "  - gemini - NOT AUTHORIZED! Run: gemini\n" +
        "  - gh (Copilot)",
    );
  });

  it("handles all requirements non-ok", () => {
    const requirements: RuntimeRequirement[] = [
      { label: "claude", status: "missing", fix: "Install: claude" },
      { label: "codex (ChatGPT)", status: "missing", fix: "Install: codex" },
      { label: "gemini", status: "missing", fix: "Install: gemini" },
      { label: "gh (Copilot)", status: "missing", fix: "Install: gh" },
    ];

    expect(formatRequiresSection(requirements)).toBe(
      "Requires:\n" +
        "  - claude - MISSING! Install: claude\n" +
        "  - codex (ChatGPT) - MISSING! Install: codex\n" +
        "  - gemini - MISSING! Install: gemini\n" +
        "  - gh (Copilot) - MISSING! Install: gh",
    );
  });
});
