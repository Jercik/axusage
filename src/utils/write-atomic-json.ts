import { chmod, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function writeAtomicJson(
  filePath: string,
  data: unknown,
  mode?: number,
): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  const writeOptions: Parameters<typeof writeFile>[2] =
    mode === undefined ? "utf8" : { encoding: "utf8" as BufferEncoding, mode };
  await writeFile(temporaryPath, JSON.stringify(data), writeOptions);
  if (mode !== undefined) {
    await chmod(temporaryPath, mode).catch(() => {
      // Best-effort: some filesystems ignore chmod, but the mode was set at write.
    });
  }
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
