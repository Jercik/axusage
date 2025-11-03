import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { fetchClaudeJsonFromPage } from "./fetch-claude-json-from-page.js";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

export async function requestService(
  service: SupportedService,
  url: string,
  getContext: () => Promise<BrowserContext>,
): Promise<string> {
  if (service === "claude") {
    // Single, deterministic strategy: load usage page and capture its JSON request
    return await fetchClaudeJsonFromPage(await getContext());
  }
  if (service === "chatgpt") {
    return await fetchChatGPTJson(await getContext(), url);
  }
  return await fetchJsonWithContext(await getContext(), url);
}
