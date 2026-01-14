import { chmod, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function writeAtomicJson(
  filePath: string,
  data: unknown,
  mode?: number,
): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(data), "utf8");
  if (mode !== undefined) {
    await chmod(temporaryPath, mode).catch(() => {});
  }
  await rename(temporaryPath, filePath);
}
