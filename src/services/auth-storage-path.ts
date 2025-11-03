import path from "node:path";
import type { SupportedService } from "./supported-service.js";

export function getStorageStatePathFor(
  dataDirectory: string,
  service: SupportedService,
): string {
  return path.join(dataDirectory, `${service}-auth.json`);
}
