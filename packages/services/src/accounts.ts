import { accountInputSchema, firstIssue } from "@cashow/domain";
import { writeAudit } from "./audit";
import type { DbTransaction, QueryClient, UseCaseContext } from "./context";
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
  /** Opening balance plus every live transaction that touches the account. */
  balance: bigint;
}

interface AccountBalanceRow {
  id: string;
  name: string;
  type: string;
  openingBalance: string;
  currency: string;
  archivedAt: string;
  balance: string;
}

/**
 * Accounts with a derived balance (plan §2: "Derive, do not store").
 *
 * The two-branch aggregate is deliberate: a `LEFT JOIN … ON (accountId = a OR
 * destinationAccountId = a)` cannot use one index for both sides and degrades
 * on a large ledger (benchmark §8).
 */
export async function listAccounts(ctx: UseCaseContext): Promise<Result<AccountSummary[]>> {
  try {
    const plan = ctx.db.raw.sql`
      SELECT a."id" AS id,
             a."name" AS name,
             a."type" AS type,
             a."openingBalance"::text AS "openingBalance",
             a."currency" AS currency,
             COALESCE(a."archivedAt"::text, '') AS "archivedAt",
             (a."openingBalance" + COALESCE(m.delta, 0))::text AS balance
      FROM "public"."Account" a
      LEFT JOIN (
        SELECT x.id AS id, SUM(x.delta) AS delta
        FROM (
          SELECT "accountId" AS id,
                 CASE "type"
                   WHEN 'EXPENSE' THEN -"amount"
                   WHEN 'TRANSFER' THEN -"amount"
                   ELSE "amount"
                 END AS delta
          FROM "public"."Transaction"
          WHERE "userId" = ${ctx.userId} AND "deletedAt" IS NULL
          UNION ALL
          SELECT "destinationAccountId" AS id, "amount" AS delta
          FROM "public"."Transaction"
          WHERE "userId" = ${ctx.userId} AND "deletedAt" IS NULL
            AND "type" = 'TRANSFER' AND "destinationAccountId" IS NOT NULL
        ) x
        GROUP BY x.id
      ) m ON m.id = a."id"
      WHERE a."userId" = ${ctx.userId}
      ORDER BY (a."archivedAt" IS NOT NULL), a."name"
    `
      .returnsRow({
        id: "pg/text@1",
        name: "pg/text@1",
        type: "pg/text@1",
        openingBalance: "pg/text@1",
        currency: "pg/text@1",
        archivedAt: "pg/text@1",
        balance: "pg/text@1",
      })
      .build();

    const rows = await ctx.db.query(plan);
    return ok(rows.map(mapAccount));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getAccount(
  client: QueryClient,
  userId: string,
  accountId: string,
): Promise<AccountSummary | null> {
  const plan = client.raw.sql`
    SELECT a."id" AS id,
           a."name" AS name,
           a."type" AS type,
           a."openingBalance"::text AS "openingBalance",
           a."currency" AS currency,
           COALESCE(a."archivedAt"::text, '') AS "archivedAt",
           (a."openingBalance" + COALESCE(m.delta, 0))::text AS balance
    FROM "public"."Account" a
    LEFT JOIN (
      SELECT x.id AS id, SUM(x.delta) AS delta
      FROM (
        SELECT "accountId" AS id,
               CASE "type"
                 WHEN 'EXPENSE' THEN -"amount"
                 WHEN 'TRANSFER' THEN -"amount"
                 ELSE "amount"
               END AS delta
        FROM "public"."Transaction"
        WHERE "userId" = ${userId} AND "deletedAt" IS NULL
        UNION ALL
        SELECT "destinationAccountId" AS id, "amount" AS delta
        FROM "public"."Transaction"
        WHERE "userId" = ${userId} AND "deletedAt" IS NULL
          AND "type" = 'TRANSFER' AND "destinationAccountId" IS NOT NULL
      ) x
      GROUP BY x.id
    ) m ON m.id = a."id"
    WHERE a."userId" = ${userId} AND a."id" = ${accountId}
  `
    .returnsRow({
      id: "pg/text@1",
      name: "pg/text@1",
      type: "pg/text@1",
      openingBalance: "pg/text@1",
      currency: "pg/text@1",
      archivedAt: "pg/text@1",
      balance: "pg/text@1",
    })
    .build();

  const rows = await client.query(plan);
  const row = rows[0];
  return row === undefined ? null : mapAccount(row);
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

function mapAccount(row: AccountBalanceRow): AccountSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AccountType,
    openingBalance: BigInt(row.openingBalance),
    currency: row.currency,
    archivedAt: row.archivedAt === "" ? null : row.archivedAt,
    balance: BigInt(row.balance),
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
