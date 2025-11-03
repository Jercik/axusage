import type { BrowserContext } from "playwright";
import type { SupportedService } from "./supported-service.js";
import { setupAuthInContext } from "./setup-auth-flow.js";

export async function doSetupAuth(
  service: SupportedService,
  context: BrowserContext,
  storagePath: string,
  instructions: string,
): Promise<void> {
  console.log(`\n${instructions}`);
  console.log("Waiting for login to complete (or press Enter to continue)\n");
  await setupAuthInContext(service, context, storagePath);
  console.log(
    `\n✓ Authentication saved for ${service}. You can now close the browser.`,
  );
}
