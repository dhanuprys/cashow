import {
  ageInDays,
  checkpointUnlockSchema,
  firstIssue,
  type GapKind,
  gapKind,
  localDateTimeToUtc,
  parseDbTimestamp,
  snapshotCreateSchema,
  snapshotUpdateSchema,
} from "@cashow/domain";
import { type AccountSummary, getAccount } from "./accounts";
import { writeAudit } from "./audit";
import { type QueryClient, type UseCaseContext, userTimezone } from "./context";
import { isUniqueViolation, LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

/**
 * Balance snapshots and reconciliation (plan §2).
 *
 * A snapshot is a stated bank balance at an instant. The expected balance and
 * the gap are never stored: every read walks the previous stated snapshot and
 * the live transactions in `(previous, current]`, so inserting or deleting a
 * backdated snapshot automatically recomputes every later gap.
 */

export interface CheckpointSummary {
  id: string;
  accountId: string;
  snapshotId: string;
  snapshotAt: string;
  verifiedAt: string;
  unlockedAt: string | null;
  unlockReason: string | null;
  /** A checkpoint with no unlock still freezes its period. */
  active: boolean;
}

export interface SnapshotSummary {
  id: string;
  accountId: string;
  amount: bigint;
  recordedAt: string;
  expectedAmount: bigint;
  gap: bigint;
  gapKind: GapKind;
  transactionCount: number;
  note: string | null;
  createdAt: string;
  checkpoint: CheckpointSummary | null;
}

export interface AccountReconciliation {
  account: AccountSummary;
  snapshots: SnapshotSummary[];
}

interface SnapshotRow {
  id: string;
  accountId: string;
  amount: string;
  recordedAt: string;
  expectedAmount: string;
  gap: string;
  transactionCount: bigint;
  note: string | null;
  createdAt: string;
  checkpointId: string | null;
  checkpointAt: string | null;
  checkpointVerifiedAt: string | null;
  checkpointUnlockedAt: string | null;
  checkpointUnlockReason: string | null;
}

interface CheckpointRow {
  id: string;
  accountId: string;
  snapshotId: string;
  snapshotAt: string;
  verifiedAt: string;
  unlockedAt: string | null;
  unlockReason: string | null;
}

const SNAPSHOT_ROW_CODECS = {
  id: "pg/text@1",
  accountId: "pg/text@1",
  amount: "pg/text@1",
  recordedAt: "pg/text@1",
  expectedAmount: "pg/text@1",
  gap: "pg/text@1",
  transactionCount: "pg/int8@1",
  note: { codecId: "pg/text@1", nullable: true },
  createdAt: "pg/text@1",
  checkpointId: { codecId: "pg/text@1", nullable: true },
  checkpointAt: { codecId: "pg/text@1", nullable: true },
  checkpointVerifiedAt: { codecId: "pg/text@1", nullable: true },
  checkpointUnlockedAt: { codecId: "pg/text@1", nullable: true },
  checkpointUnlockReason: { codecId: "pg/text@1", nullable: true },
} as const;

const CHECKPOINT_ROW_CODECS = {
  id: "pg/text@1",
  accountId: "pg/text@1",
  snapshotId: "pg/text@1",
  snapshotAt: "pg/text@1",
  verifiedAt: "pg/text@1",
  unlockedAt: { codecId: "pg/text@1", nullable: true },
  unlockReason: { codecId: "pg/text@1", nullable: true },
} as const;

/** Snapshots for one account, oldest first, each with its derived gap. */
export async function listSnapshots(
  ctx: UseCaseContext,
  accountId: string,
): Promise<Result<SnapshotSummary[]>> {
  try {
    const rows = await loadSnapshotRows(ctx.db, ctx.userId, accountId);
    return ok(rows.map(mapSnapshot));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getAccountReconciliation(
  ctx: UseCaseContext,
  accountId: string,
): Promise<Result<AccountReconciliation>> {
  try {
    const [account, snapshots] = await Promise.all([
      getAccount(ctx.db, ctx.userId, accountId),
      listSnapshots(ctx, accountId),
    ]);
    if (account === null) return err(new LedgerError("NOT_FOUND", "Akun tidak ditemukan."));
    if (!snapshots.ok) return snapshots;
    return ok({ account, snapshots: snapshots.value });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createSnapshot(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<SnapshotSummary>> {
  const parsed = snapshotCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const id = await ctx.db.transaction(async (tx) => {
      const account = await tx.orm.public.Account.where({
        id: data.accountId,
        userId: ctx.userId,
      }).first();
      if (account === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      const timezone = await userTimezone(tx, ctx.userId);
      const recordedAt = localDateTimeToUtc(data.recordedAtLocal, timezone);

      const snapshot = await tx.orm.public.BalanceSnapshot.create({
        userId: ctx.userId,
        accountId: data.accountId,
        amount: data.amount,
        recordedAt: recordedAt.toISOString(),
        note: data.note,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "BalanceSnapshot",
        entityId: snapshot.id,
        action: "CREATE",
        after: snapshot,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "BalanceSnapshot",
        aggregateId: snapshot.id,
        eventType: "balance_snapshot.created",
        payload: snapshot,
      });

      return snapshot.id;
    });

    const snapshots = await listSnapshots(ctx, data.accountId);
    if (!snapshots.ok) return snapshots;
    const snapshot = snapshots.value.find((row) => row.id === id);
    if (snapshot === undefined) {
      throw new LedgerError("INTERNAL", "Snapshot gagal dibaca kembali.");
    }
    return ok(snapshot);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return err(
        new LedgerError("CONFLICT", "Sudah ada snapshot untuk akun ini pada waktu tersebut."),
      );
    }
    return err(toLedgerError(error));
  }
}

export async function updateSnapshot(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<SnapshotSummary>> {
  const parsed = snapshotUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const txResult = await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.BalanceSnapshot.where({
        id: data.snapshotId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");
      if (before.deletedAt !== null) {
        throw new LedgerError("CONFLICT", "Snapshot yang dihapus tidak bisa diubah.");
      }

      // A verified checkpoint freezes the period; unlock it first.
      const checkpoint = await tx.orm.public.ReconciliationCheckpoint.where({
        snapshotId: data.snapshotId,
        userId: ctx.userId,
      })
        .where({ unlockedAt: null })
        .first();
      if (checkpoint !== null) {
        throw new LedgerError(
          "CONFLICT",
          "Snapshot ini sudah diverifikasi. Buka kunci checkpoint dulu sebelum mengubah.",
        );
      }

      const account = await tx.orm.public.Account.where({
        id: before.accountId,
        userId: ctx.userId,
      }).first();
      if (account === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      const timezone = await userTimezone(tx, ctx.userId);
      const recordedAt = localDateTimeToUtc(data.recordedAtLocal, timezone);

      // Unique (accountId, recordedAt) constraint — check for collision with another snapshot.
      const collision = await tx.orm.public.BalanceSnapshot.where({
        accountId: before.accountId,
        userId: ctx.userId,
      })
        .where({ recordedAt: recordedAt.toISOString() })
        .first();
      if (collision !== null && collision.id !== data.snapshotId) {
        throw new LedgerError("CONFLICT", "Sudah ada snapshot untuk akun ini pada waktu tersebut.");
      }

      const after = await tx.orm.public.BalanceSnapshot.where({
        id: data.snapshotId,
        userId: ctx.userId,
      }).update({
        amount: data.amount,
        recordedAt: recordedAt.toISOString(),
        note: data.note,
      });
      if (after === null) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "BalanceSnapshot",
        entityId: data.snapshotId,
        action: "UPDATE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "BalanceSnapshot",
        aggregateId: data.snapshotId,
        eventType: "balance_snapshot.updated",
        payload: after,
      });

      return { id: data.snapshotId, accountId: before.accountId };
    });

    const snapshots = await listSnapshots(ctx, txResult.accountId);
    if (!snapshots.ok) return snapshots;
    const snapshot = snapshots.value.find((row) => row.id === txResult.id);
    if (snapshot === undefined) {
      throw new LedgerError("INTERNAL", "Snapshot gagal dibaca kembali.");
    }
    return ok(snapshot);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return err(
        new LedgerError("CONFLICT", "Sudah ada snapshot untuk akun ini pada waktu tersebut."),
      );
    }
    return err(toLedgerError(error));
  }
}

export async function softDeleteSnapshot(
  ctx: UseCaseContext,
  snapshotId: string,
): Promise<Result<{ id: string }>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.BalanceSnapshot.where({
        id: snapshotId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");
      if (before.deletedAt !== null) return;

      const after = await tx.orm.public.BalanceSnapshot.where({
        id: snapshotId,
        userId: ctx.userId,
      }).update({ deletedAt: new Date().toISOString() });
      if (after === null) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "BalanceSnapshot",
        entityId: snapshotId,
        action: "SOFT_DELETE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "BalanceSnapshot",
        aggregateId: snapshotId,
        eventType: "balance_snapshot.deleted",
        payload: after,
      });
    });

    return ok({ id: snapshotId });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Mark a zero-gap snapshot as verified. The service checks the gap for a clear
 * message; the database trigger re-checks it inside the insert, so a race or a
 * direct write cannot bypass the rule.
 */
export async function verifyCheckpoint(
  ctx: UseCaseContext,
  snapshotId: string,
): Promise<Result<CheckpointSummary>> {
  try {
    const checkpoint = await ctx.db.transaction(async (tx) => {
      const snapshot = await tx.orm.public.BalanceSnapshot.where({
        id: snapshotId,
        userId: ctx.userId,
      }).first();
      if (snapshot === null) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");
      if (snapshot.deletedAt !== null) {
        throw new LedgerError("CONFLICT", "Snapshot yang dihapus tidak bisa diverifikasi.");
      }

      const rows = await loadSnapshotRows(tx, ctx.userId, snapshot.accountId);
      const derived = rows.find((row) => row.id === snapshotId);
      if (derived === undefined) throw new LedgerError("NOT_FOUND", "Snapshot tidak ditemukan.");
      const gap = BigInt(derived.gap);
      if (gap !== 0n) {
        const direction = gap < 0n ? "pengeluaran belum tercatat" : "pemasukan belum tercatat";
        const amount = gap < 0n ? -gap : gap;
        throw new LedgerError(
          "CONFLICT",
          `Snapshot belum seimbang: selisih ${amount} (${direction}). Catat penyesuaian dulu.`,
        );
      }

      const latest = await loadLatestActiveCheckpoint(tx, ctx.userId, snapshot.accountId);
      if (latest !== null) {
        const latestAt = parseDbTimestamp(latest.snapshotAt);
        if (latestAt.getTime() >= parseDbTimestamp(snapshot.recordedAt).getTime()) {
          throw new LedgerError(
            "CONFLICT",
            "Sudah ada checkpoint pada atau setelah snapshot ini. Buka kuncinya dulu.",
          );
        }
      }

      const created = await tx.orm.public.ReconciliationCheckpoint.create({
        userId: ctx.userId,
        accountId: snapshot.accountId,
        snapshotId: snapshot.id,
        snapshotAt: snapshot.recordedAt,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "ReconciliationCheckpoint",
        entityId: created.id,
        action: "VERIFY",
        after: created,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "ReconciliationCheckpoint",
        aggregateId: created.id,
        eventType: "reconciliation_checkpoint.verified",
        payload: created,
      });

      return created;
    });

    return ok(mapCheckpoint(checkpoint));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function unlockCheckpoint(
  ctx: UseCaseContext,
  checkpointId: string,
  input: unknown,
): Promise<Result<CheckpointSummary>> {
  const parsed = checkpointUnlockSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    const checkpoint = await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.ReconciliationCheckpoint.where({
        id: checkpointId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Checkpoint tidak ditemukan.");
      if (before.unlockedAt !== null) return before;

      const after = await tx.orm.public.ReconciliationCheckpoint.where({
        id: checkpointId,
        userId: ctx.userId,
      }).update({
        unlockedAt: new Date().toISOString(),
        unlockReason: parsed.data.reason,
      });
      if (after === null) throw new LedgerError("NOT_FOUND", "Checkpoint tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "ReconciliationCheckpoint",
        entityId: checkpointId,
        action: "UNLOCK",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "ReconciliationCheckpoint",
        aggregateId: checkpointId,
        eventType: "reconciliation_checkpoint.unlocked",
        payload: after,
      });

      return after;
    });

    return ok(mapCheckpoint(checkpoint));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function listCheckpoints(
  ctx: UseCaseContext,
  accountId: string,
): Promise<Result<CheckpointSummary[]>> {
  try {
    const plan = ctx.db.raw.sql`
      SELECT c."id" AS id,
             c."accountId" AS "accountId",
             c."snapshotId" AS "snapshotId",
             c."snapshotAt"::text AS "snapshotAt",
             c."verifiedAt"::text AS "verifiedAt",
             c."unlockedAt"::text AS "unlockedAt",
             c."unlockReason" AS "unlockReason"
      FROM "public"."ReconciliationCheckpoint" c
      WHERE c."userId" = ${ctx.userId} AND c."accountId" = ${accountId}
      ORDER BY c."snapshotAt" DESC, c."verifiedAt" DESC
    `
      .returnsRow(CHECKPOINT_ROW_CODECS)
      .build();
    const rows = await ctx.db.query(plan);
    return ok(rows.map(mapCheckpoint));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function loadSnapshotRows(
  client: QueryClient,
  userId: string,
  accountId: string,
): Promise<SnapshotRow[]> {
  const plan = client.raw.sql`
    SELECT s."id" AS id,
           s."accountId" AS "accountId",
           s."amount"::text AS amount,
           s."recordedAt"::text AS "recordedAt",
           (COALESCE(prev."amount", a."openingBalance") + COALESCE(mv.delta, 0))::text AS "expectedAmount",
           (s."amount" - (COALESCE(prev."amount", a."openingBalance") + COALESCE(mv.delta, 0)))::text AS gap,
           COALESCE(mv.cnt, 0)::bigint AS "transactionCount",
           s."note" AS note,
           s."createdAt"::text AS "createdAt",
           cp."id" AS "checkpointId",
           cp."snapshotAt"::text AS "checkpointAt",
           cp."verifiedAt"::text AS "checkpointVerifiedAt",
           cp."unlockedAt"::text AS "checkpointUnlockedAt",
           cp."unlockReason" AS "checkpointUnlockReason"
    FROM "public"."BalanceSnapshot" s
    JOIN "public"."Account" a ON a."id" = s."accountId" AND a."userId" = s."userId"
    LEFT JOIN LATERAL (
      SELECT p."amount", p."recordedAt"
      FROM "public"."BalanceSnapshot" p
      WHERE p."accountId" = s."accountId"
        AND p."deletedAt" IS NULL
        AND p."recordedAt" < s."recordedAt"
      ORDER BY p."recordedAt" DESC
      LIMIT 1
    ) prev ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(x.delta), 0) AS delta, count(*)::bigint AS cnt
      FROM (
        SELECT CASE WHEN t."type" IN ('EXPENSE', 'TRANSFER') THEN -t."amount" ELSE t."amount" END AS delta
        FROM "public"."Transaction" t
        WHERE t."userId" = s."userId"
          AND t."deletedAt" IS NULL
          AND t."accountId" = s."accountId"
          AND t."occurredAt" <= s."recordedAt"
          AND (prev."recordedAt" IS NULL OR t."occurredAt" > prev."recordedAt")
        UNION ALL
        SELECT t."amount" AS delta
        FROM "public"."Transaction" t
        WHERE t."userId" = s."userId"
          AND t."deletedAt" IS NULL
          AND t."type" = 'TRANSFER'
          AND t."destinationAccountId" = s."accountId"
          AND t."occurredAt" <= s."recordedAt"
          AND (prev."recordedAt" IS NULL OR t."occurredAt" > prev."recordedAt")
      ) x
    ) mv ON true
    LEFT JOIN LATERAL (
      SELECT c."id", c."snapshotAt", c."verifiedAt", c."unlockedAt", c."unlockReason"
      FROM "public"."ReconciliationCheckpoint" c
      WHERE c."snapshotId" = s."id"
      ORDER BY (c."unlockedAt" IS NULL) DESC, c."verifiedAt" DESC
      LIMIT 1
    ) cp ON true
    WHERE s."userId" = ${userId}
      AND s."accountId" = ${accountId}
      AND s."deletedAt" IS NULL
    ORDER BY s."recordedAt" ASC
  `
    .returnsRow(SNAPSHOT_ROW_CODECS)
    .build();

  return client.query(plan);
}

async function loadLatestActiveCheckpoint(
  client: QueryClient,
  userId: string,
  accountId: string,
): Promise<CheckpointRow | null> {
  const plan = client.raw.sql`
    SELECT c."id" AS id,
           c."accountId" AS "accountId",
           c."snapshotId" AS "snapshotId",
           c."snapshotAt"::text AS "snapshotAt",
           c."verifiedAt"::text AS "verifiedAt",
           c."unlockedAt"::text AS "unlockedAt",
           c."unlockReason" AS "unlockReason"
    FROM "public"."ReconciliationCheckpoint" c
    WHERE c."userId" = ${userId}
      AND c."accountId" = ${accountId}
      AND c."unlockedAt" IS NULL
    ORDER BY c."snapshotAt" DESC
    LIMIT 1
  `
    .returnsRow(CHECKPOINT_ROW_CODECS)
    .build();
  const rows = await client.query(plan);
  return rows[0] ?? null;
}

function mapSnapshot(row: SnapshotRow): SnapshotSummary {
  const gap = BigInt(row.gap);
  return {
    id: row.id,
    accountId: row.accountId,
    amount: BigInt(row.amount),
    recordedAt: parseDbTimestamp(row.recordedAt).toISOString(),
    expectedAmount: BigInt(row.expectedAmount),
    gap,
    gapKind: gapKind(gap),
    transactionCount: Number(row.transactionCount),
    note: row.note,
    createdAt: parseDbTimestamp(row.createdAt).toISOString(),
    checkpoint:
      row.checkpointId === null || row.checkpointAt === null || row.checkpointVerifiedAt === null
        ? null
        : {
            id: row.checkpointId,
            accountId: row.accountId,
            snapshotId: row.id,
            snapshotAt: parseDbTimestamp(row.checkpointAt).toISOString(),
            verifiedAt: parseDbTimestamp(row.checkpointVerifiedAt).toISOString(),
            unlockedAt:
              row.checkpointUnlockedAt === null
                ? null
                : parseDbTimestamp(row.checkpointUnlockedAt).toISOString(),
            unlockReason: row.checkpointUnlockReason,
            active: row.checkpointUnlockedAt === null,
          },
  };
}

function mapCheckpoint(row: CheckpointRow): CheckpointSummary {
  return {
    id: row.id,
    accountId: row.accountId,
    snapshotId: row.snapshotId,
    snapshotAt: parseDbTimestamp(row.snapshotAt).toISOString(),
    verifiedAt: parseDbTimestamp(row.verifiedAt).toISOString(),
    unlockedAt: row.unlockedAt === null ? null : parseDbTimestamp(row.unlockedAt).toISOString(),
    unlockReason: row.unlockReason,
    active: row.unlockedAt === null,
  };
}

/** Age of the latest snapshot in whole days, for the stale-balance label. */
export function snapshotAgeDays(recordedAt: string, now: Date = new Date()): number | null {
  if (recordedAt === "") return null;
  return ageInDays(parseDbTimestamp(recordedAt), now);
}
