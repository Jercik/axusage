import type { BrowserContext, Response } from "playwright";

const USAGE_PAGE = "https://claude.ai/settings/usage";
const USAGE_API =
  /^https:\/\/claude\.ai\/api\/organizations\/[^/]+\/usage(?:\?.*)?$/iu;
const LOGIN_URL_PATTERN = /claude\.ai\/login/iu;
const LOGIN_REDIRECT_ERROR_MESSAGE =
  "Redirected to login page. Please run 'agent-usage auth setup claude' to re-authenticate.";

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
    const waitForJson = page
      .waitForResponse(
        (response) =>
          USAGE_API.test(response.url()) && isJsonResponse(response),
        { timeout: 60_000 },
      )
      .catch((error) => {
        // Avoid unhandled rejection if we bail early on login redirect; rethrow otherwise
        if (!LOGIN_URL_PATTERN.test(page.url())) {
          throw error;
        }
      });

    const response = await page.goto(USAGE_PAGE, {
      waitUntil: "domcontentloaded",
    });

    // Fast fail if we are redirected to login
    if (response && LOGIN_URL_PATTERN.test(response.url())) {
      throw new Error(LOGIN_REDIRECT_ERROR_MESSAGE);
    }

    try {
      const apiResponse = await waitForJson;
      if (!apiResponse) {
        throw new Error(LOGIN_REDIRECT_ERROR_MESSAGE);
      }
      return await apiResponse.text();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Timeout") &&
        LOGIN_URL_PATTERN.test(page.url())
      ) {
        throw new Error(LOGIN_REDIRECT_ERROR_MESSAGE);
      }
      throw error;
    }
  } finally {
    await page.close();
  }
}
