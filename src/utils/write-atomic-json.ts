import { chmod, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    return (error as NodeJS.ErrnoException).code;
  }
  return undefined;
}

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
    const code = getErrorCode(error);
    if (code === "EPERM" || code === "EACCES" || code === "EEXIST") {
      // Windows can reject rename over an existing file; fall back to a backup swap.
      const backupPath = `${filePath}.${randomUUID()}.bak`;
      let hasBackup = false;
      try {
        await rename(filePath, backupPath);
        hasBackup = true;
      } catch {
        // Best-effort: source file may not exist or be locked.
      }

      try {
        await rename(temporaryPath, filePath);
      } catch (fallbackError) {
        if (hasBackup) {
          await rename(backupPath, filePath).catch(() => {});
        }
        await unlink(temporaryPath).catch(() => {});
        throw fallbackError;
      }

      if (hasBackup) {
        await unlink(backupPath).catch(() => {});
      }
      return;
    }
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}
