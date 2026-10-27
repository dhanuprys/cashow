/**
 * Backup freshness sources (plan §7). The services layer reads the status
 * files `backup.sh` and `restore-drill.sh` leave next to the artefacts through
 * the `BackupStatusReader` port, so no use case touches `node:fs` directly and
 * a test can supply an in-memory reader.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BackupStatusReader } from "./context";

/** Default mount point of `BACKUP_DIR` in the Compose stack. */
export const DEFAULT_BACKUP_DIR = "/backups";

/**
 * Read `last-run.json` / `last-drill.json` from a local directory and return
 * the `at` stamp. A missing, unreadable or malformed file returns `null`, which
 * the rules engine turns into "never ran".
 */
export function createFileBackupStatusReader(dir: string): BackupStatusReader {
  return {
    lastRunAt: () => readStamp(join(dir, "last-run.json")),
    lastDrillAt: () => readStamp(join(dir, "last-drill.json")),
  };
}

async function readStamp(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return null;
    const at = (parsed as { at?: unknown }).at;
    return typeof at === "string" && at.length > 0 ? at : null;
  } catch {
    return null;
  }
}
