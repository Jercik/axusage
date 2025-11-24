import type { BrowserContext, Response } from "playwright";

const USAGE_PAGE = "https://claude.ai/settings/usage";
const USAGE_API =
  /^https:\/\/claude\.ai\/api\/organizations\/[^/]+\/usage(?:\?.*)?$/iu;
const LOGIN_URL_PATTERN = /claude\.ai\/login/iu;

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

    const response = await page.goto(USAGE_PAGE, {
      waitUntil: "domcontentloaded",
    });

    // Fast fail if we are redirected to login
    if (response && LOGIN_URL_PATTERN.test(response.url())) {
      throw new Error(
        "Redirected to login page. Please run 'agent-usage auth setup claude' to re-authenticate.",
      );
    }

    try {
      const apiResponse = await waitForJson;
      return await apiResponse.text();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Timeout") &&
        LOGIN_URL_PATTERN.test(page.url())
      ) {
        throw new Error(
          "Redirected to login page. Please run 'agent-usage auth setup claude' to re-authenticate.",
        );
      }
      throw error;
    }
  } finally {
    await page.close();
  }
}
