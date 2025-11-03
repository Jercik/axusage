import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { fetchClaudeJson } from "./fetch-claude-json.js";
import { fetchChatGPTJson } from "./fetch-chatgpt-json.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";
import { fetchJsonWithStorage } from "./fetch-json-with-storage.js";

export async function requestService(
  service: SupportedService,
  url: string,
  getContext: () => Promise<BrowserContext>,
  storageStatePath: string,
): Promise<string> {
  if (service === "claude") {
    try {
      return await fetchClaudeJson(await getContext(), url);
    } catch {
      return await fetchJsonWithStorage(storageStatePath, url);
    }
  }
  if (service === "chatgpt") {
    return await fetchChatGPTJson(await getContext(), url);
  }
  return await fetchJsonWithContext(await getContext(), url);
}
