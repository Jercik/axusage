import { BrowserAuthManager } from "./browser-auth-manager.js";

let manager: BrowserAuthManager | undefined;
let references = 0;
let cleanupInstalled = false;
let closing = false;
let exitInitiated = false;

export function acquireAuthManager(): BrowserAuthManager {
  if (!manager) manager = new BrowserAuthManager();
  references++;
  return manager;
}

export async function releaseAuthManager(): Promise<void> {
  if (references <= 0) {
    // Over-release guard: surface a warning to aid debugging
    if (references === 0) {
      console.warn(
        "releaseAuthManager() called more times than acquireAuthManager()",
      );
    }
    // Avoid closing the manager in an over-release state
    return;
  }
  references -= 1;
  if (references === 0 && manager) {
    await manager.close();
    manager = undefined;
  }
}

async function forceClose(): Promise<void> {
  if (closing) return;
  closing = true;
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
  /* eslint-disable unicorn/no-process-exit */
  const safeExit = (code: number) => {
    if (exitInitiated) return;
    exitInitiated = true;
    process.exit(code);
  };
  /* eslint-enable unicorn/no-process-exit */
  process.on("SIGINT", () => {
    // Ensure browser is actually closed before exiting
    void forceClose().finally(() => {
      safeExit(130);
    });
  });
  process.on("SIGTERM", () => {
    // Ensure browser is actually closed before exiting
    void forceClose().finally(() => {
      safeExit(143);
    });
  });
  process.on("beforeExit", () => {
    // Best-effort cleanup on natural process exit; defer exit until closed
    // to avoid leaving Chromium running in the background.
    // Using exitCode preserves the intended code without forcing a new one.
    // Note: process.exit() triggers 'exit' (not 'beforeExit'), so no loop.
    if (process.exitCode === undefined) process.exitCode = 0;
    void forceClose().finally(() => {
      safeExit(Number(process.exitCode ?? 0));
    });
  });
}
