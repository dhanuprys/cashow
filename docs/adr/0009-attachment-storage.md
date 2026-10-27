# 0009 — Attachment bytes on local disk behind a storage port

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Phase 1 lets a transaction carry proof: a photo of a receipt, an invoice PDF, a
contract. The metadata belongs in Postgres — it is queryable, auditable, and
must be deleted/restored with the transaction — while the bytes do not. A
receipt photo in a `bytea` column inflates every dump, slows the ledger, and is
read in full by any query that forgets to project columns.

The deployment is a single host with a 2 GB memory budget (ADR 0005), and the
backup target is an external drive. Whatever stores bytes must:

- survive a container restart and a `docker compose up --build`,
- be included in the nightly backup and the monthly restore drill,
- never let a malformed key escape the uploads directory,
- keep working if the storage backend changes later (object storage, a
  different host).

## Decision

Store attachment metadata in Postgres and bytes on a local volume, behind a
small port.

| Concern  | Where it lives                                                                            |
| -------- | ----------------------------------------------------------------------------------------- |
| Metadata | `Attachment` row: `kind`, `fileName`, `mimeType`, `byteSize`, `contentHash`, `storageKey` |
| Bytes    | `STORAGE_DIR` (default `./data/uploads`; `/app/data/uploads` in Compose)                  |
| Contract | `AttachmentStorage` in `packages/services/src/storage.ts`: `put`, `get`, `has`, `delete`  |
| Driver   | `apps/web/lib/storage.ts` (`LocalAttachmentStorage`)                                      |

Details that matter:

- **Content-addressed, user-scoped keys.** `storageKey` is
  `<userId>/<sha256>.<ext>`. The same receipt uploaded twice resolves to the same
  bytes; `contentHash` and `byteSize` are stored so a restore can verify them.
- **Traversal is rejected at the boundary.** The driver normalises with
  `path.posix.normalize`, refuses absolute keys, `..` segments, and NUL bytes,
  then asserts the resolved path is inside `STORAGE_DIR`. The service never
  builds a path from user input directly.
- **Uploads are compressed in the browser.** The uploader downscales photos to
  1600 px on the long edge and re-encodes as JPEG before sending; a 10 MB cap in
  the service is a backstop, not the normal path.
- **Serving goes through the session.** `GET /api/attachments/:id` checks the
  reader owns the attachment and returns `Cache-Control: private` plus
  `X-Content-Type-Options: nosniff`. There is no public bucket and no signed URL
  to leak.
- **Delete is soft.** Removing an attachment marks the row deleted and removes
  the blob only after the database transaction commits. Restoring is a phase 2+
  concern; keeping the blob until then is cheap and reversible.
- **The volume is a named volume, not a bind mount.** `docker compose` names it
  `cashow_files` and mounts it at `/app/data`; `web` and `worker` share it, and
  the root filesystem stays read-only.

## Consequences

- `pg_dump` alone is **not** a complete backup. `deploy/backup.sh` archives
  `STORAGE_DIR` alongside the dump (`cashow-<stamp>-files.tar.gz`) and encrypts
  both with age; `deploy/restore-files.sh` restores the archive into a target
  directory. A restore drill must restore both and compare `contentHash` or at
  least count files per user.
- The Compose `files` volume must be on the external drive or beamed to it; a
  backup service that only ships the dump silently loses every receipt.
- Migrating to object storage later means writing a second driver, backfilling
  `storageKey`, and keeping the `AttachmentStorage` contract unchanged. No
  query in the ledger knows where the bytes live.
- A single host means no replication: the external drive is the redundancy.
