import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { fetchJsonWithContext } from "./fetch-json-with-context.js";

export async function requestService(
  service: SupportedService,
  url: string,
  getContext: () => Promise<BrowserContext>,
): Promise<string> {
  return await fetchJsonWithContext(await getContext(), url);
}
