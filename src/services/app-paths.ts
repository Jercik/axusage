import envPaths from "env-paths";
import path from "node:path";

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
