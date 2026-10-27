import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttachmentStorage } from "@cashow/services";

/**
 * Local-disk attachment storage (ADR 0009).
 *
 * Keys are content-addressed and user-scoped (`<userId>/<sha256>.<ext>`). The
 * resolver rejects anything that would escape `STORAGE_DIR`, so a malformed
 * key cannot read or write outside the uploads volume.
 */
export const DEFAULT_STORAGE_DIR = "./data/uploads";

export function storageDirectory(): string {
  // The directory is deployment configuration, not a bundle input: opt out of
  // Turbopack's file tracing so the whole repository is not swept into the
  // standalone output.
  return path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_DIR ?? DEFAULT_STORAGE_DIR);
}

function resolveKey(key: string): string {
  const root = storageDirectory();
  const normalised = path.posix.normalize(key);

  if (
    normalised === "" ||
    normalised === "." ||
    normalised.startsWith("/") ||
    normalised.startsWith("../") ||
    normalised.includes("/../") ||
    normalised.includes("\0")
  ) {
    throw new Error(`Invalid attachment storage key: ${key}`);
  }

  const full = path.resolve(root, normalised);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Attachment storage key escapes the storage root: ${key}`);
  }
  return full;
}

class LocalAttachmentStorage implements AttachmentStorage {
  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = resolveKey(key);
    await mkdir(/* turbopackIgnore: true */ path.dirname(target), { recursive: true });
    await writeFile(/* turbopackIgnore: true */ target, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(/* turbopackIgnore: true */ resolveKey(key));
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const info = await stat(/* turbopackIgnore: true */ resolveKey(key));
      return info.isFile();
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(/* turbopackIgnore: true */ resolveKey(key), { force: true });
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
  );
}

/** One driver instance per process is enough: it holds no connections. */
export const attachmentStorage: AttachmentStorage = new LocalAttachmentStorage();
