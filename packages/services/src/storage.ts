/**
 * Attachment bytes live behind a small storage port (plan §7: the Compose
 * stack mounts a `files` volume). The service never touches `node:fs`, so the
 * same use case runs against local disk in production and memory in tests.
 */
export interface AttachmentStorage {
  /** Write bytes idempotently at a content-addressed key. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Read bytes, or `null` when the object does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  /** Whether an object already exists at `key`. */
  has(key: string): Promise<boolean>;
  /** Remove an object. Missing keys are not an error. */
  delete(key: string): Promise<void>;
}
