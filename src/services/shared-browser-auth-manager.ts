import { BrowserAuthManager } from "./browser-auth-manager.js";

let manager: BrowserAuthManager | undefined;
let references = 0;
let cleanupInstalled = false;

export function acquireAuthManager(): BrowserAuthManager {
  if (!manager) manager = new BrowserAuthManager();
  references++;
  return manager;
}

export async function releaseAuthManager(): Promise<void> {
  references = Math.max(0, references - 1);
  if (references === 0 && manager) {
    await manager.close();
    manager = undefined;
  }
}

async function forceClose(): Promise<void> {
  references = 0;
  if (manager) {
    try {
      await manager.close();
    } catch {
      // ignore
    } finally {
      manager = undefined;
    }
  }
}

export function installAuthManagerCleanup(): void {
  if (cleanupInstalled) return;
  cleanupInstalled = true;
  process.on("SIGINT", () => {
    void forceClose();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    void forceClose();
    process.exit(143);
  });
  process.on("beforeExit", () => {
    void forceClose();
  });
}
