import type { BrowserContext, Response } from "playwright";

const USAGE_PAGE = "https://claude.ai/settings/usage";
const USAGE_API =
  /^https:\/\/claude\.ai\/api\/organizations\/[^/]+\/usage(?:\?.*)?$/iu;

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
      (response) => USAGE_API.test(response.url()) && isJsonResponse(response),
      { timeout: 60_000 },
    );

    await page.goto(USAGE_PAGE, { waitUntil: "domcontentloaded" });

    const response = await waitForJson;
    return await response.text();
  } finally {
    await page.close();
  }
}
