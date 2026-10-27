import { accountInputSchema, ageInDays, firstIssue, parseDbTimestamp } from "@cashow/domain";
import { writeAudit } from "./audit";
import { type DbTransaction, nowOf, type QueryClient, type UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

export type AccountType = "BANK" | "EWALLET" | "CASH" | "INVESTMENT";

export interface AccountSummary {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: bigint;
  currency: string;
  archivedAt: string | null;
  /**
   * Estimated live balance: the latest snapshot plus every live movement after
   * it, or the opening balance plus the whole ledger when no snapshot exists.
   */
  balance: bigint;
  /** The latest stated balance, or null when the account has no snapshot. */
  snapshotBalance: bigint | null;
  snapshotRecordedAt: string | null;
  /** Whole days since the latest snapshot, for the stale-balance label. */
  snapshotAgeDays: number | null;
  /** The snapshot instant of the newest active checkpoint. */
  lastCheckpointAt: string | null;
}

interface AccountBalanceRow {
  id: string;
  name: string;
  type: string;
  openingBalance: string;
  currency: string;
  archivedAt: string;
  balance: string;
  snapshotBalance: string | null;
  snapshotRecordedAt: string | null;
  lastCheckpointAt: string | null;
}

const ACCOUNT_ROW_CODECS = {
  id: "pg/text@1",
  name: "pg/text@1",
  type: "pg/text@1",
  openingBalance: "pg/text@1",
  currency: "pg/text@1",
  archivedAt: "pg/text@1",
  balance: "pg/text@1",
  snapshotBalance: { codecId: "pg/text@1", nullable: true },
  snapshotRecordedAt: { codecId: "pg/text@1", nullable: true },
  lastCheckpointAt: { codecId: "pg/text@1", nullable: true },
} as const;

/**
 * Accounts with a derived balance (plan §2: "Derive, do not store").
 *
 * With a snapshot, the estimate starts from the stated balance and only adds
 * movements after it. Without one, it is the opening balance plus the ledger.
 * The two-branch movement aggregate is deliberate: a
 * `LEFT JOIN … ON (accountId = a OR destinationAccountId = a)` cannot use one
 * index for both sides and degrades on a large ledger (benchmark §8).
 */
export async function listAccounts(ctx: UseCaseContext): Promise<Result<AccountSummary[]>> {
  try {
    const rows = await loadAccountRows(ctx.db, ctx.userId, "");
    const now = nowOf(ctx);
    return ok(rows.map((row) => mapAccount(row, now)));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getAccount(
  client: QueryClient,
  userId: string,
  accountId: string,
): Promise<AccountSummary | null> {
  const rows = await loadAccountRows(client, userId, accountId);
  const row = rows[0];
  return row === undefined ? null : mapAccount(row, new Date());
}

async function loadAccountRows(
  client: QueryClient,
  userId: string,
  accountId: string,
): Promise<AccountBalanceRow[]> {
  const plan = client.raw.sql`
    SELECT a."id" AS id,
           a."name" AS name,
           a."type" AS type,
           a."openingBalance"::text AS "openingBalance",
           a."currency" AS currency,
           COALESCE(a."archivedAt"::text, '') AS "archivedAt",
           CASE WHEN snap."amount" IS NOT NULL
                THEN (snap."amount" + COALESCE(m.delta_after, 0))::text
                ELSE (a."openingBalance" + COALESCE(m.delta_all, 0))::text
           END AS balance,
           snap."amount"::text AS "snapshotBalance",
           snap."recordedAt"::text AS "snapshotRecordedAt",
           cp."snapshotAt"::text AS "lastCheckpointAt"
    FROM "public"."Account" a
    LEFT JOIN LATERAL (
      SELECT s."amount", s."recordedAt"
      FROM "public"."BalanceSnapshot" s
      WHERE s."accountId" = a."id" AND s."deletedAt" IS NULL
      ORDER BY s."recordedAt" DESC
      LIMIT 1
    ) snap ON true
    LEFT JOIN LATERAL (
      SELECT SUM(x.delta) AS delta_all,
             SUM(CASE WHEN snap."recordedAt" IS NULL OR x."occurredAt" > snap."recordedAt"
                      THEN x.delta ELSE 0 END) AS delta_after
      FROM (
        SELECT CASE "type"
                 WHEN 'EXPENSE' THEN -"amount"
                 WHEN 'TRANSFER' THEN -"amount"
                 ELSE "amount"
               END AS delta,
               "occurredAt" AS "occurredAt"
        FROM "public"."Transaction"
        WHERE "userId" = ${userId} AND "deletedAt" IS NULL AND "accountId" = a."id"
        UNION ALL
        SELECT "amount" AS delta, "occurredAt" AS "occurredAt"
        FROM "public"."Transaction"
        WHERE "userId" = ${userId} AND "deletedAt" IS NULL
          AND "type" = 'TRANSFER' AND "destinationAccountId" = a."id"
      ) x
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT c."snapshotAt"
      FROM "public"."ReconciliationCheckpoint" c
      WHERE c."accountId" = a."id" AND c."unlockedAt" IS NULL
      ORDER BY c."snapshotAt" DESC
      LIMIT 1
    ) cp ON true
    WHERE a."userId" = ${userId}
      AND (NULLIF(${accountId}, '')::text IS NULL OR a."id" = ${accountId})
    ORDER BY (a."archivedAt" IS NOT NULL), a."name"
  `
    .returnsRow(ACCOUNT_ROW_CODECS)
    .build();

  return client.query(plan);
}

export async function createAccount(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<AccountSummary>> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    const created = await ctx.db.transaction(async (tx) => {
      const account = await tx.orm.public.Account.create({
        userId: ctx.userId,
        name: parsed.data.name,
        type: parsed.data.type,
        openingBalance: parsed.data.openingBalance,
        currency: parsed.data.currency,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Account",
        entityId: account.id,
        action: "CREATE",
        after: account,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Account",
        aggregateId: account.id,
        eventType: "account.created",
        payload: account,
      });

      return account;
    });

    const summary = await getAccount(ctx.db, ctx.userId, created.id);
    if (summary === null) throw new LedgerError("INTERNAL", "Akun gagal dibaca kembali.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateAccount(
  ctx: UseCaseContext,
  accountId: string,
  input: unknown,
): Promise<Result<AccountSummary>> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Account.where({
        id: accountId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      const after = await tx.orm.public.Account.where({ id: accountId, userId: ctx.userId }).update(
        {
          name: parsed.data.name,
          type: parsed.data.type,
          openingBalance: parsed.data.openingBalance,
          currency: parsed.data.currency,
        },
      );
      if (after === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Account",
        entityId: accountId,
        action: "UPDATE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Account",
        aggregateId: accountId,
        eventType: "account.updated",
        payload: { before, after },
      });
    });

    const summary = await getAccount(ctx.db, ctx.userId, accountId);
    if (summary === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function setAccountArchived(
  ctx: UseCaseContext,
  accountId: string,
  archived: boolean,
): Promise<Result<AccountSummary>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Account.where({
        id: accountId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      const archivedAt = archived ? new Date().toISOString() : null;
      const after = await tx.orm.public.Account.where({ id: accountId, userId: ctx.userId }).update(
        {
          archivedAt,
        },
      );
      if (after === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Account",
        entityId: accountId,
        action: archived ? "ARCHIVE" : "UNARCHIVE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Account",
        aggregateId: accountId,
        eventType: archived ? "account.archived" : "account.unarchived",
        payload: after,
      });
    });

    const summary = await getAccount(ctx.db, ctx.userId, accountId);
    if (summary === null) throw new LedgerError("NOT_FOUND", "Akun tidak ditemukan.");
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

function mapAccount(row: AccountBalanceRow, now: Date): AccountSummary {
  const snapshotRecordedAt =
    row.snapshotRecordedAt === null ? null : parseDbTimestamp(row.snapshotRecordedAt).toISOString();
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    openingBalance: BigInt(row.openingBalance),
    currency: row.currency,
    archivedAt: row.archivedAt === "" ? null : row.archivedAt,
    balance: BigInt(row.balance),
    snapshotBalance: row.snapshotBalance === null ? null : BigInt(row.snapshotBalance),
    snapshotRecordedAt,
    snapshotAgeDays:
      snapshotRecordedAt === null ? null : ageInDays(parseDbTimestamp(snapshotRecordedAt), now),
    lastCheckpointAt:
      row.lastCheckpointAt === null ? null : parseDbTimestamp(row.lastCheckpointAt).toISOString(),
  };
}

/** Default account created for the first owner (see `ensureDefaultLedger`). */
export async function ensureDefaultAccount(tx: DbTransaction, userId: string): Promise<void> {
  const existing = await tx.orm.public.Account.where({ userId }).first();
  if (existing !== null) return;

  const account = await tx.orm.public.Account.create({
    userId,
    name: "Tunai",
    type: "CASH",
    openingBalance: 0n,
    currency: "IDR",
  });

  await writeAudit(tx, {
    userId,
    entityType: "Account",
    entityId: account.id,
    action: "CREATE",
    after: account,
    actorId: null,
  });
  await writeOutbox(tx, {
    userId,
    aggregateType: "Account",
    aggregateId: account.id,
    eventType: "account.created",
    payload: account,
  });
}
