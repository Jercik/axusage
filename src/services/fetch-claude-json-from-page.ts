import type { BrowserContext, Response } from "playwright";

const USAGE_PAGE = "https://claude.ai/settings/usage";
const MATCH_PATTERNS = ["/usage", "quota", "limit"] as const;

function isJsonResponse(response: Response): boolean {
  const headers = response.headers();
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  return contentType.toLowerCase().includes("application/json");
}

export async function fetchClaudeJsonFromPage(
  context: BrowserContext,
): Promise<string> {
  const page = await context.newPage();
  try {
    const waitForJson = page.waitForResponse(
      (response) => {
        const url = response.url();
        const matches = MATCH_PATTERNS.some((pat) => url.includes(pat));
        return matches && isJsonResponse(response);
      },
      { timeout: 30_000 },
    );

    await page.goto(USAGE_PAGE, { waitUntil: "domcontentloaded" });

    const response = await waitForJson;
    return await response.text();
  } finally {
    await page.close();
  }
}
