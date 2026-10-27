import { createHash } from "node:crypto";
import { attachmentMetaSchema, firstIssue, parseDbTimestamp } from "@cashow/domain";
import { writeAudit } from "./audit";
import type { QueryClient, UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";
import type { AttachmentStorage } from "./storage";

/** 10 MB is generous for a receipt photo and keeps a runaway upload harmless. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

export interface AttachmentSummary {
  id: string;
  transactionId: string | null;
  kind: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  byteSize: bigint;
  contentHash: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface AttachmentUpload {
  transactionId: string;
  kind?: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface AttachmentFile {
  attachment: AttachmentSummary;
  bytes: Uint8Array;
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Validate, hash and store one file, then attach it to a transaction. Bytes are
 * content-addressed, so re-uploading the same receipt costs no extra storage.
 */
export async function uploadAttachment(
  ctx: UseCaseContext,
  storage: AttachmentStorage,
  input: AttachmentUpload,
): Promise<Result<AttachmentSummary>> {
  const meta = attachmentMetaSchema.safeParse({
    kind: input.kind,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  if (!meta.success) {
    return err(new LedgerError("VALIDATION", firstIssue(meta.error)));
  }

  if (input.bytes.byteLength === 0) {
    return err(new LedgerError("VALIDATION", "Berkas kosong."));
  }
  if (input.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    return err(new LedgerError("VALIDATION", "Berkas maksimal 10 MB."));
  }

  const extension = ALLOWED_MIME[meta.data.mimeType];
  if (extension === undefined) {
    return err(new LedgerError("VALIDATION", "Hanya gambar (JPG, PNG, WebP) atau PDF."));
  }

  const contentHash = hashBytes(input.bytes);
  const storageKey = `${ctx.userId}/${contentHash}${extension}`;

  try {
    // Write bytes before the row. A crash in between leaves an unreferenced
    // blob (harmless, content-addressed, swept later), never a row whose bytes
    // are missing. The row is the thing reads depend on.
    if (!(await storage.has(storageKey))) {
      await storage.put(storageKey, input.bytes);
    }

    const created = await ctx.db.transaction(async (tx) => {
      const transaction = await tx.orm.public.Transaction.where({
        id: input.transactionId,
        userId: ctx.userId,
      }).first();
      if (transaction === null) {
        throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");
      }
      if (transaction.deletedAt !== null) {
        throw new LedgerError("CONFLICT", "Transaksi yang dihapus tidak bisa diberi lampiran.");
      }

      const duplicate = await tx.orm.public.Attachment.where({
        userId: ctx.userId,
        transactionId: input.transactionId,
        contentHash,
      })
        .where((row) => row.deletedAt.isNull())
        .first();
      if (duplicate !== null) return duplicate;

      const attachment = await tx.orm.public.Attachment.create({
        userId: ctx.userId,
        transactionId: input.transactionId,
        kind: meta.data.kind,
        storageKey,
        fileName: meta.data.fileName,
        mimeType: meta.data.mimeType,
        byteSize: BigInt(input.bytes.byteLength),
        contentHash,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Attachment",
        entityId: attachment.id,
        action: "CREATE",
        after: attachment,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Attachment",
        aggregateId: attachment.id,
        eventType: "attachment.created",
        payload: attachment,
      });

      return attachment;
    });

    return ok(mapAttachment(created));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function listAttachments(
  ctx: UseCaseContext,
  transactionId: string,
): Promise<Result<AttachmentSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.Attachment.where({
      userId: ctx.userId,
      transactionId,
    })
      .where((row) => row.deletedAt.isNull())
      .orderBy((row) => row.createdAt.asc())
      .all();
    return ok(rows.map(mapAttachment));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function readAttachment(
  ctx: UseCaseContext,
  storage: AttachmentStorage,
  attachmentId: string,
): Promise<Result<AttachmentFile>> {
  try {
    const attachment = await ctx.db.orm.public.Attachment.where({
      id: attachmentId,
      userId: ctx.userId,
    })
      .where((row) => row.deletedAt.isNull())
      .first();
    if (attachment === null) {
      return err(new LedgerError("NOT_FOUND", "Lampiran tidak ditemukan."));
    }

    const bytes = await storage.get(attachment.storageKey);
    if (bytes === null) {
      return err(new LedgerError("NOT_FOUND", "Berkas lampiran tidak ditemukan di penyimpanan."));
    }

    return ok({ attachment: mapAttachment(attachment), bytes });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Soft delete the row, then remove the bytes only when no live attachment
 * (on any transaction) still points at the same content-addressed key.
 */
export async function softDeleteAttachment(
  ctx: UseCaseContext,
  storage: AttachmentStorage,
  attachmentId: string,
): Promise<Result<{ id: string }>> {
  try {
    const storageKey = await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Attachment.where({
        id: attachmentId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Lampiran tidak ditemukan.");
      if (before.deletedAt !== null) return null;

      const after = await tx.orm.public.Attachment.where({
        id: attachmentId,
        userId: ctx.userId,
      }).update({ deletedAt: new Date().toISOString() });
      if (after === null) throw new LedgerError("NOT_FOUND", "Lampiran tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Attachment",
        entityId: attachmentId,
        action: "SOFT_DELETE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Attachment",
        aggregateId: attachmentId,
        eventType: "attachment.deleted",
        payload: after,
      });

      return before.storageKey;
    });

    if (storageKey !== null) {
      const live = await countLiveByStorageKey(ctx.db, ctx.userId, storageKey);
      if (live === 0) await storage.delete(storageKey);
    }

    return ok({ id: attachmentId });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function countLiveByStorageKey(
  client: QueryClient,
  userId: string,
  storageKey: string,
): Promise<number> {
  const plan = client.raw.sql`
    SELECT count(*)::bigint AS count
    FROM "public"."Attachment"
    WHERE "userId" = ${userId} AND "storageKey" = ${storageKey} AND "deletedAt" IS NULL
  `
    .returnsRow({ count: "pg/int8@1" })
    .build();
  const rows = await client.query(plan);
  return Number(rows[0]?.count ?? 0n);
}

function mapAttachment(row: {
  id: string;
  transactionId: string | null;
  kind: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  byteSize: bigint;
  contentHash: string;
  createdAt: string;
  deletedAt: string | null;
}): AttachmentSummary {
  return {
    id: row.id,
    transactionId: row.transactionId,
    kind: row.kind,
    storageKey: row.storageKey,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    contentHash: row.contentHash,
    createdAt: parseDbTimestamp(row.createdAt).toISOString(),
    deletedAt: row.deletedAt === null ? null : parseDbTimestamp(row.deletedAt).toISOString(),
  };
}
