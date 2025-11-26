import envPaths from "env-paths";
import path from "node:path";
import { mkdir, chmod } from "node:fs/promises";

/**
 * env-paths resolves directories during module initialization, so changes to
 * environment variables (like XDG_DATA_HOME) after the first import will not
 * be picked up without restarting the process.
 */
const paths = envPaths("agent-usage", { suffix: "" });

/**
 * Directory for storing browser authentication contexts
 */
export function getBrowserContextsDirectory(): string {
  return path.join(paths.data, "browser-contexts");
}

/**
 * Ensure a directory exists with restricted permissions (owner-only access).
 * Creates the directory recursively if needed and sets mode 0o700.
 */
export async function ensureSecureDirectory(
  directoryPath: string,
): Promise<void> {
  await mkdir(directoryPath, { recursive: true, mode: 0o700 }).catch(
    (error: unknown) => {
      // mkdir may ignore mode due to umask; we'll enforce via chmod below
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        (error as { code?: unknown }).code !== "EEXIST"
      ) {
        throw error;
      }
    },
  );
  try {
    await chmod(directoryPath, 0o700);
  } catch {
    // best effort
  }
}
