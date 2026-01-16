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
    // Over-release guard: ignore unmatched release
    if (references === 0) {
      console.warn(
        "releaseAuthManager() called without a matching acquire; ignoring",
      );
    }
    // Avoid closing the manager in an over-release state
    return;
  }
  references -= 1;
  if (references === 0 && manager) {
    const closingManager = manager;
    manager = undefined;
    try {
      await closingManager.close();
    } catch {
      // Best-effort cleanup: don't let close failures propagate to callers
      // (matches forceClose semantics and prevents masking prior errors in finally blocks)
    }
  }
}

async function forceClose(): Promise<void> {
  if (closing) return;
  closing = true;
  references = 0;
  if (manager) {
    const closingManager = manager;
    manager = undefined;
    try {
      await closingManager.close();
    } catch {
      // Best-effort cleanup: ignore close failures during shutdown
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
    // Best-effort cleanup on natural process exit; ensure we schedule a macrotask
    // so the event loop stays alive until the async close finishes.
    if (process.exitCode === undefined) process.exitCode = 0;
    setImmediate(() => {
      void forceClose().finally(() => {
        safeExit(Number(process.exitCode ?? 0));
      });
    });
  });
}
