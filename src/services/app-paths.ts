import envPaths from "env-paths";
import path from "node:path";

/**
 * Get cross-platform application paths using env-paths
 */
const paths = envPaths("agent-usage", { suffix: "" });

/**
 * Directory for storing browser authentication contexts
 */
export function getBrowserContextsDirectory(): string {
  return path.join(paths.data, "browser-contexts");
}
