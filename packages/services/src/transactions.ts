import {
  type AllocationInput,
  firstIssue,
  localDateTimeToUtc,
  parseDbTimestamp,
  toLocalDate,
  transactionCreateSchema,
  transactionUpdateSchema,
  transferCreateSchema,
} from "@cashow/domain";
import { writeAudit } from "./audit";
import { type DbTransaction, type QueryClient, type UseCaseContext, userTimezone } from "./context";
import { isUniqueViolation, LedgerError, toLedgerError } from "./errors";
import { writeOutbox } from "./outbox";
import { err, ok, type Result } from "./result";

export type CashflowType = "INCOME" | "EXPENSE";

export interface TransactionSummary {
  id: string;
  type: string;
  amount: bigint;
  accountId: string;
  accountName: string;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  /** The payment-plan item this income settles, if any. */
  planItemId: string | null;
  planItemLabel: string | null;
  planId: string | null;
  planName: string | null;
  /** Set on a transfer fee expense: the transfer it belongs to. */
  transferId: string | null;
  /** Set on a transfer row: its linked fee expense, when one exists. */
  transferFeeId: string | null;
  transferFeeAmount: bigint | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  occurredAt: string;
  occurredOn: string;
  source: string;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Amount of this row already allocated (0 for incomes). */
  allocated: bigint;
  allocationCount: number;
  attachmentCount: number;
}

export interface TransactionAttachment {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  byteSize: bigint;
  createdAt: string;
}

export interface AllocationView {
  id: string;
  expenseId: string;
  incomeId: string;
  amount: bigint;
  /** The other side of the allocation: the income for an expense, and vice versa. */
  counterpartyLabel: string;
  counterpartyOccurredOn: string;
}

export interface TransactionDetail extends TransactionSummary {
  allocations: AllocationView[];
  attachments: TransactionAttachment[];
}

export interface TransactionListFilter {
  type?: CashflowType | "TRANSFER" | "ADJUSTMENT";
  accountId?: string;
  categoryId?: string;
  /** Only incomes linked to an item of this payment plan. */
  planId?: string;
  /** Inclusive local date, `YYYY-MM-DD`. */
  from?: string;
  /** Inclusive local date, `YYYY-MM-DD`. */
  to?: string;
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface TransactionListResult {
  items: TransactionSummary[];
  total: number;
  totalIncome: bigint;
  totalExpense: bigint;
}

export interface OpenIncome {
  id: string;
  amount: bigint;
  allocated: bigint;
  free: bigint;
  occurredOn: string;
  categoryName: string | null;
  note: string | null;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  kind: CashflowType;
  total: bigint;
}

export interface MonthOverview {
  month: string;
  income: bigint;
  expense: bigint;
  net: bigint;
  transactionCount: number;
  topExpenseCategories: CategoryTotal[];
}

interface TransactionRow {
  id: string;
  type: string;
  amount: string;
  accountId: string;
  accountName: string;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  planItemId: string | null;
  planItemLabel: string | null;
  planId: string | null;
  planName: string | null;
  transferId: string | null;
  transferFeeId: string | null;
  transferFeeAmount: string | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  occurredAt: string;
  occurredOn: string;
  source: string;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  allocated: string;
  allocationCount: bigint;
  attachmentCount: bigint;
}

const TRANSACTION_ROW_CODECS = {
  id: "pg/text@1",
  type: "pg/text@1",
  amount: "pg/text@1",
  accountId: "pg/text@1",
  accountName: "pg/text@1",
  destinationAccountId: { codecId: "pg/text@1", nullable: true },
  destinationAccountName: { codecId: "pg/text@1", nullable: true },
  categoryId: { codecId: "pg/text@1", nullable: true },
  categoryName: { codecId: "pg/text@1", nullable: true },
  planItemId: { codecId: "pg/text@1", nullable: true },
  planItemLabel: { codecId: "pg/text@1", nullable: true },
  planId: { codecId: "pg/text@1", nullable: true },
  planName: { codecId: "pg/text@1", nullable: true },
  transferId: { codecId: "pg/text@1", nullable: true },
  transferFeeId: { codecId: "pg/text@1", nullable: true },
  transferFeeAmount: { codecId: "pg/text@1", nullable: true },
  merchant: { codecId: "pg/text@1", nullable: true },
  counterparty: { codecId: "pg/text@1", nullable: true },
  note: { codecId: "pg/text@1", nullable: true },
  occurredAt: "pg/text@1",
  occurredOn: "pg/text@1",
  source: "pg/text@1",
  clientRequestId: { codecId: "pg/text@1", nullable: true },
  createdAt: "pg/text@1",
  updatedAt: "pg/text@1",
  deletedAt: { codecId: "pg/text@1", nullable: true },
  allocated: "pg/text@1",
  allocationCount: "pg/int8@1",
  attachmentCount: "pg/int8@1",
} as const;

/**
 * The one projection every transaction read shares. `allocated` sums only live
 * allocation rows; the database trigger treats a soft-deleted transaction's
 * allocations as void, so the UI must agree.
 *
 * Keep this shape in sync with the two raw queries below. Prisma 8's raw tag
 * binds an interpolated string as a parameter instead of splicing it, so the
 * projection is written out at each call site rather than shared as a variable.
 */
// The projection and joins are inlined in listTransactions and loadDetail.

export async function listTransactions(
  ctx: UseCaseContext,
  filter: TransactionListFilter = {},
): Promise<Result<TransactionListResult>> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 5000);
  const offset = Math.max(filter.offset ?? 0, 0);
  const pattern =
    filter.search === undefined || filter.search.trim() === "" ? "" : `%${filter.search.trim()}%`;
  const type = filter.type ?? "";
  const accountId = filter.accountId ?? "";
  const categoryId = filter.categoryId ?? "";
  const planId = filter.planId ?? "";
  const from = filter.from ?? "";
  const to = filter.to ?? "";

  try {
    const plan = ctx.db.raw.sql`
      SELECT
        t."id" AS id,
        t."type" AS type,
        t."amount"::text AS amount,
        t."accountId" AS "accountId",
        acc."name" AS "accountName",
        t."destinationAccountId" AS "destinationAccountId",
        dest."name" AS "destinationAccountName",
        t."categoryId" AS "categoryId",
        c."name" AS "categoryName",
        t."planItemId" AS "planItemId",
        pi."label" AS "planItemLabel",
        pi."planId" AS "planId",
        p."name" AS "planName",
        t."transferId" AS "transferId",
        fe."id" AS "transferFeeId",
        fe."amount"::text AS "transferFeeAmount",
        t."merchant" AS merchant,
        t."counterparty" AS counterparty,
        t."note" AS note,
        t."occurredAt"::text AS "occurredAt",
        t."occurredOn"::text AS "occurredOn",
        t."source" AS source,
        t."clientRequestId" AS "clientRequestId",
        t."createdAt"::text AS "createdAt",
        t."updatedAt"::text AS "updatedAt",
        t."deletedAt"::text AS "deletedAt",
        COALESCE(al.allocated, 0)::text AS allocated,
        COALESCE(al.cnt, 0)::bigint AS "allocationCount",
        COALESCE(att.cnt, 0)::bigint AS "attachmentCount",
        count(*) OVER ()::bigint AS "totalCount",
        COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END) OVER (), 0)::text AS "totalIncome",
        COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END) OVER (), 0)::text AS "totalExpense"
      FROM "public"."Transaction" t
      JOIN "public"."Account" acc ON acc."id" = t."accountId"
      LEFT JOIN "public"."Account" dest ON dest."id" = t."destinationAccountId"
      LEFT JOIN "public"."Category" c ON c."id" = t."categoryId"
      LEFT JOIN "public"."PaymentPlanItem" pi ON pi."id" = t."planItemId"
      LEFT JOIN "public"."PaymentPlan" p ON p."id" = pi."planId"
      LEFT JOIN "public"."Transaction" fe ON fe."transferId" = t."id" AND fe."deletedAt" IS NULL
      LEFT JOIN (
        SELECT a."expenseId" AS expense_id,
               SUM(a."amount") AS allocated,
               count(*) AS cnt
        FROM "public"."Allocation" a
        JOIN "public"."Transaction" e ON e."id" = a."expenseId"
        JOIN "public"."Transaction" i ON i."id" = a."incomeId"
        WHERE e."deletedAt" IS NULL AND i."deletedAt" IS NULL
        GROUP BY a."expenseId"
      ) al ON al.expense_id = t."id"
      LEFT JOIN (
        SELECT a."transactionId" AS transaction_id, count(*) AS cnt
        FROM "public"."Attachment" a
        WHERE a."deletedAt" IS NULL
        GROUP BY a."transactionId"
      ) att ON att.transaction_id = t."id"
      WHERE t."userId" = ${ctx.userId}
        AND (${filter.includeDeleted === true} OR t."deletedAt" IS NULL)
        AND (NULLIF(${type}, '')::text IS NULL OR t."type" = ${type})
        AND (NULLIF(${accountId}, '')::text IS NULL OR t."accountId" = ${accountId}
             OR t."destinationAccountId" = ${accountId})
        AND (NULLIF(${categoryId}, '')::text IS NULL OR t."categoryId" = ${categoryId})
        AND (NULLIF(${planId}, '')::text IS NULL OR pi."planId" = ${planId})
        AND (NULLIF(${from}, '')::date IS NULL OR t."occurredOn" >= NULLIF(${from}, '')::date)
        AND (NULLIF(${to}, '')::date IS NULL OR t."occurredOn" <= NULLIF(${to}, '')::date)
        AND (NULLIF(${pattern}, '')::text IS NULL
             OR coalesce(t."note", '') ILIKE ${pattern}
             OR coalesce(t."merchant", '') ILIKE ${pattern}
             OR coalesce(t."counterparty", '') ILIKE ${pattern}
             OR coalesce(c."name", '') ILIKE ${pattern})
      ORDER BY t."occurredAt" DESC, t."id" DESC
      LIMIT ${limit}::int OFFSET ${offset}::int
    `
      .returnsRow({
        ...TRANSACTION_ROW_CODECS,
        totalCount: "pg/int8@1",
        totalIncome: "pg/text@1",
        totalExpense: "pg/text@1",
      })
      .build();

    const rows = await ctx.db.query(plan);
    const items = rows.map((row) => mapTransaction(row));
    const total = rows.length === 0 ? 0 : Number(rows[0]?.totalCount ?? 0n);
    const totalIncome = rows.length === 0 ? 0n : BigInt(rows[0]?.totalIncome ?? "0");
    const totalExpense = rows.length === 0 ? 0n : BigInt(rows[0]?.totalExpense ?? "0");
    return ok({ items, total, totalIncome, totalExpense });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getTransaction(
  ctx: UseCaseContext,
  transactionId: string,
): Promise<Result<TransactionDetail>> {
  try {
    const detail = await loadDetail(ctx.db, ctx.userId, transactionId);
    if (detail === null) return err(new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan."));
    return ok(detail);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createTransaction(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<TransactionDetail>> {
  const parsed = transactionCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  if (data.type === "INCOME" && data.allocations.length > 0) {
    return err(
      new LedgerError("VALIDATION", "Pemasukan tidak bisa dialokasikan ke transaksi lain."),
    );
  }

  if (data.clientRequestId !== null) {
    const existing = await findByIdempotencyKey(ctx, data.clientRequestId);
    if (existing !== null) return existing;
  }

  try {
    const created = await ctx.db.transaction(async (tx) => {
      const timezone = await userTimezone(tx, ctx.userId);
      const occurredAt = localDateTimeToUtc(data.occurredAtLocal, timezone);
      const occurredOn = toLocalDate(occurredAt, timezone);

      await assertCategoryKind(tx, ctx.userId, data.categoryId, data.type);
      await assertPlanItem(tx, ctx.userId, data.planItemId, data.type);
      const allocations = normaliseAllocations(data.allocations);

      const transaction = await tx.orm.public.Transaction.create({
        userId: ctx.userId,
        type: data.type,
        amount: data.amount,
        accountId: data.accountId,
        categoryId: data.categoryId,
        planItemId: data.planItemId,
        merchant: data.merchant,
        counterparty: data.counterparty,
        note: data.note,
        occurredAt: occurredAt.toISOString(),
        occurredOn,
        source: data.source,
        clientRequestId: data.clientRequestId,
      });

      if (data.type === "EXPENSE" && allocations.length > 0) {
        await insertAllocations(tx, ctx.userId, transaction.id, data.amount, allocations);
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Transaction",
        entityId: transaction.id,
        action: "CREATE",
        after: { transaction, allocations },
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Transaction",
        aggregateId: transaction.id,
        eventType: "transaction.created",
        payload: { transaction, allocations },
      });

      return transaction;
    });

    const detail = await loadDetail(ctx.db, ctx.userId, created.id);
    if (detail === null) throw new LedgerError("INTERNAL", "Transaksi gagal dibaca kembali.");
    return ok(detail);
  } catch (error) {
    if (isUniqueViolation(error) && data.clientRequestId !== null) {
      const existing = await findByIdempotencyKey(ctx, data.clientRequestId);
      if (existing !== null) return existing;
    }
    return err(toLedgerError(error));
  }
}

/**
 * A transfer between the owner's own accounts. The fee is a separate EXPENSE
 * linked to the transfer (plan §3: "bank fees never become mystery gaps"), so
 * the source balance falls by `amount + fee`, the destination rises by
 * `amount`, and the fee is ordinary spending with its own category.
 */
export async function createTransfer(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<TransactionDetail>> {
  const parsed = transferCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  if (data.accountId === data.destinationAccountId) {
    return err(new LedgerError("VALIDATION", "Akun asal dan tujuan transfer harus berbeda."));
  }

  if (data.clientRequestId !== null) {
    const existing = await findByIdempotencyKey(ctx, data.clientRequestId);
    if (existing !== null) return existing;
  }

  try {
    const created = await ctx.db.transaction(async (tx) => {
      const timezone = await userTimezone(tx, ctx.userId);
      const occurredAt = localDateTimeToUtc(data.occurredAtLocal, timezone);
      const occurredOn = toLocalDate(occurredAt, timezone);

      const source = await tx.orm.public.Account.where({
        id: data.accountId,
        userId: ctx.userId,
      }).first();
      if (source === null) throw new LedgerError("NOT_FOUND", "Akun asal tidak ditemukan.");
      if (source.archivedAt !== null) {
        throw new LedgerError("CONFLICT", "Akun asal sudah diarsipkan.");
      }
      const destination = await tx.orm.public.Account.where({
        id: data.destinationAccountId,
        userId: ctx.userId,
      }).first();
      if (destination === null) throw new LedgerError("NOT_FOUND", "Akun tujuan tidak ditemukan.");
      if (destination.archivedAt !== null) {
        throw new LedgerError("CONFLICT", "Akun tujuan sudah diarsipkan.");
      }

      const transfer = await tx.orm.public.Transaction.create({
        userId: ctx.userId,
        type: "TRANSFER",
        amount: data.amount,
        accountId: data.accountId,
        destinationAccountId: data.destinationAccountId,
        note: data.note,
        occurredAt: occurredAt.toISOString(),
        occurredOn,
        source: data.source,
        clientRequestId: data.clientRequestId,
      });

      let fee: { id: string } | null = null;
      if (data.feeAmount > 0n) {
        const feeCategoryId = await ensureTransferFeeCategory(tx, ctx.userId, data.feeCategoryId);
        const createdFee = await tx.orm.public.Transaction.create({
          userId: ctx.userId,
          type: "EXPENSE",
          amount: data.feeAmount,
          accountId: data.accountId,
          categoryId: feeCategoryId,
          transferId: transfer.id,
          merchant: destination.name,
          note: `Biaya transfer ke ${destination.name}`,
          occurredAt: occurredAt.toISOString(),
          occurredOn,
          source: data.source,
        });
        fee = createdFee;

        await writeAudit(tx, {
          userId: ctx.userId,
          entityType: "Transaction",
          entityId: createdFee.id,
          action: "CREATE",
          after: createdFee,
        });
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Transaction",
        entityId: transfer.id,
        action: "CREATE",
        after: { transaction: transfer, fee },
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Transaction",
        aggregateId: transfer.id,
        eventType: "transfer.created",
        payload: { transaction: transfer, fee },
      });

      return transfer;
    });

    const detail = await loadDetail(ctx.db, ctx.userId, created.id);
    if (detail === null) throw new LedgerError("INTERNAL", "Transfer gagal dibaca kembali.");
    return ok(detail);
  } catch (error) {
    if (isUniqueViolation(error) && data.clientRequestId !== null) {
      const existing = await findByIdempotencyKey(ctx, data.clientRequestId);
      if (existing !== null) return existing;
    }
    return err(toLedgerError(error));
  }
}

export async function updateTransaction(
  ctx: UseCaseContext,
  transactionId: string,
  input: unknown,
): Promise<Result<TransactionDetail>> {
  const parsed = transactionUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");
      if (before.deletedAt !== null) {
        throw new LedgerError("CONFLICT", "Pulihkan transaksi sebelum mengubahnya.");
      }
      if (before.type === "TRANSFER" || before.type === "ADJUSTMENT") {
        throw new LedgerError("VALIDATION", "Transaksi ini tidak bisa diubah dari halaman ini.");
      }
      if (before.transferId !== null) {
        throw new LedgerError("CONFLICT", "Biaya transfer diubah bersama transaksi transfernya.");
      }

      const amount = data.amount ?? before.amount;
      const allocations =
        data.allocations === undefined ? undefined : normaliseAllocations(data.allocations);

      if (allocations !== undefined && before.type === "INCOME" && allocations.length > 0) {
        throw new LedgerError("VALIDATION", "Pemasukan tidak bisa dialokasikan ke transaksi lain.");
      }

      if (data.categoryId !== undefined) {
        await assertCategoryKind(tx, ctx.userId, data.categoryId, before.type as CashflowType);
      }
      if (data.planItemId !== undefined) {
        await assertPlanItem(tx, ctx.userId, data.planItemId, before.type);
      }

      const patch: Record<string, unknown> = {};
      if (data.amount !== undefined) patch.amount = data.amount;
      if (data.accountId !== undefined) patch.accountId = data.accountId;
      if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
      if (data.planItemId !== undefined) patch.planItemId = data.planItemId;
      if (data.merchant !== undefined) patch.merchant = data.merchant;
      if (data.counterparty !== undefined) patch.counterparty = data.counterparty;
      if (data.note !== undefined) patch.note = data.note;

      if (data.occurredAtLocal !== undefined) {
        const timezone = await userTimezone(tx, ctx.userId);
        const occurredAt = localDateTimeToUtc(data.occurredAtLocal, timezone);
        patch.occurredAt = occurredAt.toISOString();
        patch.occurredOn = toLocalDate(occurredAt, timezone);
      }

      // Replace allocations first: deleting old rows lifts the sum check while
      // the amount or the set is shrinking, then the new rows are validated
      // against the final amount.
      if (allocations !== undefined) {
        await tx.orm.public.Allocation.where({
          expenseId: transactionId,
          userId: ctx.userId,
        }).deleteAll();
      }

      const after = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).update(patch);
      if (after === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");

      if (allocations !== undefined && allocations.length > 0) {
        if (before.type !== "EXPENSE") {
          throw new LedgerError("VALIDATION", "Hanya pengeluaran yang bisa dialokasikan.");
        }
        await insertAllocations(tx, ctx.userId, transactionId, amount, allocations);
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Transaction",
        entityId: transactionId,
        action: "UPDATE",
        before,
        after: { transaction: after, allocations },
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Transaction",
        aggregateId: transactionId,
        eventType: "transaction.updated",
        payload: { before, after: { transaction: after, allocations } },
      });
    });

    const detail = await loadDetail(ctx.db, ctx.userId, transactionId);
    if (detail === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");
    return ok(detail);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function softDeleteTransaction(
  ctx: UseCaseContext,
  transactionId: string,
): Promise<Result<{ id: string }>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");
      if (before.deletedAt !== null) return;
      if (before.transferId !== null) {
        throw new LedgerError("CONFLICT", "Hapus transaksi transfernya untuk menghapus biaya ini.");
      }

      const deletedAt = new Date().toISOString();
      const after = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).update({ deletedAt });
      if (after === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");

      // A fee belongs to its transfer: deleting the transfer deletes the fee in
      // the same write, so the pair can never be split by accident.
      if (before.type === "TRANSFER") {
        await cascadeTransferFeeDeletedAt(tx, ctx.userId, transactionId, deletedAt);
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Transaction",
        entityId: transactionId,
        action: "SOFT_DELETE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Transaction",
        aggregateId: transactionId,
        eventType: "transaction.deleted",
        payload: after,
      });
    });

    return ok({ id: transactionId });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function restoreTransaction(
  ctx: UseCaseContext,
  transactionId: string,
): Promise<Result<{ id: string }>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).first();
      if (before === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");
      if (before.deletedAt === null) return;
      if (before.transferId !== null) {
        throw new LedgerError(
          "CONFLICT",
          "Pulihkan transaksi transfernya untuk memulihkan biaya ini.",
        );
      }

      // The trigger re-checks the allocation sum on restore, so a restored
      // transaction can never exceed an income it already drew from.
      const after = await tx.orm.public.Transaction.where({
        id: transactionId,
        userId: ctx.userId,
      }).update({ deletedAt: null });
      if (after === null) throw new LedgerError("NOT_FOUND", "Transaksi tidak ditemukan.");

      if (before.type === "TRANSFER") {
        await cascadeTransferFeeDeletedAt(tx, ctx.userId, transactionId, null);
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "Transaction",
        entityId: transactionId,
        action: "RESTORE",
        before,
        after,
      });
      await writeOutbox(tx, {
        userId: ctx.userId,
        aggregateType: "Transaction",
        aggregateId: transactionId,
        eventType: "transaction.restored",
        payload: after,
      });
    });

    return ok({ id: transactionId });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Incomes with money left, newest first. The allocation picker on an expense
 * passes `excludeExpenseId` so the expense's own current allocations do not
 * make the incomes look poorer than they will be after an edit.
 */
export async function listOpenIncomes(
  ctx: UseCaseContext,
  options: { excludeExpenseId?: string; limit?: number; includeFullyAllocated?: boolean } = {},
): Promise<Result<OpenIncome[]>> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const exclude = options.excludeExpenseId ?? "";
  const includeFullyAllocated = options.includeFullyAllocated === true;

  try {
    const plan = ctx.db.raw.sql`
      SELECT i."id" AS id,
             i."amount"::text AS amount,
             COALESCE(SUM(a."amount"), 0)::text AS allocated,
             (i."amount" - COALESCE(SUM(a."amount"), 0))::text AS free,
             i."occurredOn"::text AS "occurredOn",
             c."name" AS "categoryName",
             i."note" AS note
      FROM "public"."Transaction" i
      LEFT JOIN "public"."Allocation" a
        ON a."incomeId" = i."id"
       AND (NULLIF(${exclude}, '')::text IS NULL OR a."expenseId" <> ${exclude})
      LEFT JOIN "public"."Category" c ON c."id" = i."categoryId"
      WHERE i."userId" = ${ctx.userId}
        AND i."type" = 'INCOME'
        AND i."deletedAt" IS NULL
      GROUP BY i."id", i."amount", i."occurredOn", i."occurredAt", c."name", i."note"
      HAVING ${includeFullyAllocated} OR i."amount" - COALESCE(SUM(a."amount"), 0) > 0
      ORDER BY i."occurredAt" DESC, i."id" DESC
      LIMIT ${limit}::int
    `
      .returnsRow({
        id: "pg/text@1",
        amount: "pg/text@1",
        allocated: "pg/text@1",
        free: "pg/text@1",
        occurredOn: "pg/text@1",
        categoryName: { codecId: "pg/text@1", nullable: true },
        note: { codecId: "pg/text@1", nullable: true },
      })
      .build();

    const rows = await ctx.db.query(plan);
    return ok(
      rows.map((row) => ({
        id: row.id,
        amount: BigInt(row.amount),
        allocated: BigInt(row.allocated),
        free: BigInt(row.free),
        occurredOn: row.occurredOn,
        categoryName: row.categoryName,
        note: row.note,
      })),
    );
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** Income, expense and net for one local month (`YYYY-MM`) plus top spending. */
export async function getMonthOverview(
  ctx: UseCaseContext,
  month: string,
): Promise<Result<MonthOverview>> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return err(new LedgerError("VALIDATION", "Bulan harus dalam format YYYY-MM."));
  }

  const start = `${month}-01`;
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText);
  const next =
    monthIndex === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;

  try {
    const totalsPlan = ctx.db.raw.sql`
      SELECT COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END), 0)::text AS income,
             COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END), 0)::text AS expense,
             count(*)::bigint AS "transactionCount"
      FROM "public"."Transaction" t
      WHERE t."userId" = ${ctx.userId}
        AND t."deletedAt" IS NULL
        AND t."type" IN ('INCOME', 'EXPENSE')
        AND t."occurredOn" >= ${start}::date
        AND t."occurredOn" < ${next}::date
    `
      .returnsRow({
        income: "pg/text@1",
        expense: "pg/text@1",
        transactionCount: "pg/int8@1",
      })
      .build();

    const rows = await ctx.db.query(totalsPlan);
    const row = rows[0];
    if (row === undefined) throw new LedgerError("INTERNAL", "Ringkasan bulan gagal dibaca.");

    const income = BigInt(row.income);
    const expense = BigInt(row.expense);

    const categoriesPlan = ctx.db.raw.sql`
      SELECT t."categoryId" AS "categoryId",
             COALESCE(c."name", 'Tanpa kategori') AS name,
             SUM(t."amount")::text AS total
      FROM "public"."Transaction" t
      LEFT JOIN "public"."Category" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${ctx.userId}
        AND t."deletedAt" IS NULL
        AND t."type" = 'EXPENSE'
        AND t."occurredOn" >= ${start}::date
        AND t."occurredOn" < ${next}::date
      GROUP BY t."categoryId", c."name"
      ORDER BY SUM(t."amount") DESC
      LIMIT 6
    `
      .returnsRow({
        categoryId: { codecId: "pg/text@1", nullable: true },
        name: "pg/text@1",
        total: "pg/text@1",
      })
      .build();

    const categoryRows = await ctx.db.query(categoriesPlan);

    return ok({
      month,
      income,
      expense,
      net: income - expense,
      transactionCount: Number(row.transactionCount),
      topExpenseCategories: categoryRows.map((category) => ({
        categoryId: category.categoryId,
        name: category.name,
        kind: "EXPENSE" as const,
        total: BigInt(category.total),
      })),
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function findByIdempotencyKey(
  ctx: UseCaseContext,
  clientRequestId: string,
): Promise<Result<TransactionDetail> | null> {
  try {
    const row = await ctx.db.orm.public.Transaction.where({
      userId: ctx.userId,
      clientRequestId,
    }).first();
    if (row === null) return null;
    const detail = await loadDetail(ctx.db, ctx.userId, row.id);
    return detail === null ? null : ok(detail);
  } catch {
    return null;
  }
}

async function loadDetail(
  client: QueryClient,
  userId: string,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const plan = client.raw.sql`
    SELECT
      t."id" AS id,
      t."type" AS type,
      t."amount"::text AS amount,
      t."accountId" AS "accountId",
      acc."name" AS "accountName",
      t."destinationAccountId" AS "destinationAccountId",
      dest."name" AS "destinationAccountName",
      t."categoryId" AS "categoryId",
      c."name" AS "categoryName",
      t."planItemId" AS "planItemId",
      pi."label" AS "planItemLabel",
      pi."planId" AS "planId",
      p."name" AS "planName",
      t."transferId" AS "transferId",
      fe."id" AS "transferFeeId",
      fe."amount"::text AS "transferFeeAmount",
      t."merchant" AS merchant,
      t."counterparty" AS counterparty,
      t."note" AS note,
      t."occurredAt"::text AS "occurredAt",
      t."occurredOn"::text AS "occurredOn",
      t."source" AS source,
      t."clientRequestId" AS "clientRequestId",
      t."createdAt"::text AS "createdAt",
      t."updatedAt"::text AS "updatedAt",
      t."deletedAt"::text AS "deletedAt",
      COALESCE(al.allocated, 0)::text AS allocated,
      COALESCE(al.cnt, 0)::bigint AS "allocationCount",
      COALESCE(att.cnt, 0)::bigint AS "attachmentCount"
    FROM "public"."Transaction" t
    JOIN "public"."Account" acc ON acc."id" = t."accountId"
    LEFT JOIN "public"."Account" dest ON dest."id" = t."destinationAccountId"
    LEFT JOIN "public"."Category" c ON c."id" = t."categoryId"
    LEFT JOIN "public"."PaymentPlanItem" pi ON pi."id" = t."planItemId"
    LEFT JOIN "public"."PaymentPlan" p ON p."id" = pi."planId"
    LEFT JOIN "public"."Transaction" fe ON fe."transferId" = t."id" AND fe."deletedAt" IS NULL
    LEFT JOIN (
      SELECT a."expenseId" AS expense_id,
             SUM(a."amount") AS allocated,
             count(*) AS cnt
      FROM "public"."Allocation" a
      JOIN "public"."Transaction" e ON e."id" = a."expenseId"
      JOIN "public"."Transaction" i ON i."id" = a."incomeId"
      WHERE e."deletedAt" IS NULL AND i."deletedAt" IS NULL
      GROUP BY a."expenseId"
    ) al ON al.expense_id = t."id"
    LEFT JOIN (
      SELECT a."transactionId" AS transaction_id, count(*) AS cnt
      FROM "public"."Attachment" a
      WHERE a."deletedAt" IS NULL
      GROUP BY a."transactionId"
    ) att ON att.transaction_id = t."id"
    WHERE t."userId" = ${userId} AND t."id" = ${transactionId}
  `
    .returnsRow(TRANSACTION_ROW_CODECS)
    .build();

  const rows = await client.query(plan);
  const row = rows[0];
  if (row === undefined) return null;

  const allocationPlan = client.raw.sql`
    SELECT a."id" AS id,
           a."expenseId" AS "expenseId",
           a."incomeId" AS "incomeId",
           a."amount"::text AS amount,
           COALESCE(oc."name", o."merchant", o."note", 'Tanpa keterangan') AS "counterpartyLabel",
           o."occurredOn"::text AS "counterpartyOccurredOn"
    FROM "public"."Allocation" a
    JOIN "public"."Transaction" o
      ON o."id" = CASE WHEN ${row.type} = 'EXPENSE' THEN a."incomeId" ELSE a."expenseId" END
    LEFT JOIN "public"."Category" oc ON oc."id" = o."categoryId"
    WHERE a."expenseId" = ${transactionId} OR a."incomeId" = ${transactionId}
    ORDER BY o."occurredAt" DESC
  `
    .returnsRow({
      id: "pg/text@1",
      expenseId: "pg/text@1",
      incomeId: "pg/text@1",
      amount: "pg/text@1",
      counterpartyLabel: "pg/text@1",
      counterpartyOccurredOn: "pg/text@1",
    })
    .build();

  const attachmentPlan = client.raw.sql`
    SELECT a."id" AS id,
           a."kind" AS kind,
           a."fileName" AS "fileName",
           a."mimeType" AS "mimeType",
           a."byteSize"::text AS "byteSize",
           a."createdAt"::text AS "createdAt"
    FROM "public"."Attachment" a
    WHERE a."userId" = ${userId}
      AND a."transactionId" = ${transactionId}
      AND a."deletedAt" IS NULL
    ORDER BY a."createdAt" ASC
  `
    .returnsRow({
      id: "pg/text@1",
      kind: "pg/text@1",
      fileName: "pg/text@1",
      mimeType: "pg/text@1",
      byteSize: "pg/text@1",
      createdAt: "pg/text@1",
    })
    .build();

  const [allocationRows, attachmentRows] = await Promise.all([
    client.query(allocationPlan),
    client.query(attachmentPlan),
  ]);

  return {
    ...mapTransaction(row),
    allocations: allocationRows.map((allocation) => ({
      id: allocation.id,
      expenseId: allocation.expenseId,
      incomeId: allocation.incomeId,
      amount: BigInt(allocation.amount),
      counterpartyLabel: allocation.counterpartyLabel,
      counterpartyOccurredOn: allocation.counterpartyOccurredOn,
    })),
    attachments: attachmentRows.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      byteSize: BigInt(attachment.byteSize),
      createdAt: parseDbTimestamp(attachment.createdAt).toISOString(),
    })),
  };
}

interface NormalisedAllocation {
  incomeId: string;
  amount: bigint;
}

function normaliseAllocations(allocations: AllocationInput[]): NormalisedAllocation[] {
  const merged = new Map<string, bigint>();
  for (const allocation of allocations) {
    if (allocation.amount <= 0n) {
      throw new LedgerError("VALIDATION", "Jumlah alokasi harus lebih dari nol.");
    }
    merged.set(allocation.incomeId, (merged.get(allocation.incomeId) ?? 0n) + allocation.amount);
  }
  return [...merged].map(([incomeId, amount]) => ({ incomeId, amount }));
}

async function insertAllocations(
  tx: DbTransaction,
  userId: string,
  expenseId: string,
  expenseAmount: bigint,
  allocations: NormalisedAllocation[],
): Promise<void> {
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0n);
  if (total > expenseAmount) {
    throw new LedgerError("CONFLICT", "Alokasi melebihi jumlah pengeluaran.");
  }

  const incomeIds = allocations.map((allocation) => allocation.incomeId);
  const incomes = await tx.orm.public.Transaction.where((row) => row.id.in(incomeIds)).all();

  const byId = new Map(incomes.map((income) => [income.id, income]));
  for (const allocation of allocations) {
    const income = byId.get(allocation.incomeId);
    if (income === undefined || income.userId !== userId) {
      throw new LedgerError("VALIDATION", "Pemasukan yang dipilih tidak ditemukan.");
    }
    if (income.type !== "INCOME") {
      throw new LedgerError("VALIDATION", "Alokasi hanya bisa menarik dari pemasukan.");
    }
    if (income.deletedAt !== null) {
      throw new LedgerError("CONFLICT", "Pemasukan yang dipilih sudah dihapus.");
    }
  }

  const existing = await tx.orm.public.Allocation.where((row) => row.incomeId.in(incomeIds)).all();

  const usedByIncome = new Map<string, bigint>();
  for (const allocation of existing) {
    if (allocation.expenseId === expenseId) continue;
    usedByIncome.set(
      allocation.incomeId,
      (usedByIncome.get(allocation.incomeId) ?? 0n) + allocation.amount,
    );
  }

  for (const allocation of allocations) {
    const income = byId.get(allocation.incomeId);
    if (income === undefined) continue;
    const used = usedByIncome.get(allocation.incomeId) ?? 0n;
    if (used + allocation.amount > income.amount) {
      throw new LedgerError("CONFLICT", "Alokasi melebihi sisa pemasukan yang tersedia.");
    }
  }

  for (const allocation of allocations) {
    await tx.orm.public.Allocation.create({
      userId,
      expenseId,
      incomeId: allocation.incomeId,
      amount: allocation.amount,
    });
  }
}

async function assertPlanItem(
  tx: DbTransaction,
  userId: string,
  planItemId: string | null,
  type: string,
): Promise<void> {
  if (planItemId === null) return;
  if (type !== "INCOME") {
    throw new LedgerError("VALIDATION", "Hanya pemasukan yang bisa dikaitkan ke rencana.");
  }
  const item = await tx.orm.public.PaymentPlanItem.where({
    id: planItemId,
    userId,
  }).first();
  if (item === null) throw new LedgerError("VALIDATION", "Tahap pembayaran tidak ditemukan.");
  const plan = await tx.orm.public.PaymentPlan.where({
    id: item.planId,
    userId,
  }).first();
  if (plan === null) throw new LedgerError("VALIDATION", "Rencana tidak ditemukan.");
  if (plan.archivedAt !== null) {
    throw new LedgerError("CONFLICT", "Rencana sudah diarsipkan.");
  }
}

/** Find (or create) the default EXPENSE category used for transfer fees. */
async function ensureTransferFeeCategory(
  tx: DbTransaction,
  userId: string,
  categoryId: string | null,
): Promise<string> {
  if (categoryId !== null) {
    const category = await tx.orm.public.Category.where({ id: categoryId, userId }).first();
    if (category === null) throw new LedgerError("VALIDATION", "Kategori tidak ditemukan.");
    if (category.kind !== "EXPENSE") {
      throw new LedgerError("VALIDATION", "Biaya transfer harus memakai kategori pengeluaran.");
    }
    return category.id;
  }

  const existing = await tx.orm.public.Category.where({
    userId,
    kind: "EXPENSE",
    name: "Biaya Transfer",
  }).first();
  if (existing !== null) return existing.id;

  const created = await tx.orm.public.Category.create({
    userId,
    name: "Biaya Transfer",
    kind: "EXPENSE",
  });
  await writeAudit(tx, {
    userId,
    entityType: "Category",
    entityId: created.id,
    action: "CREATE",
    after: created,
  });
  await writeOutbox(tx, {
    userId,
    aggregateType: "Category",
    aggregateId: created.id,
    eventType: "category.created",
    payload: created,
  });
  return created.id;
}

/** Delete or restore the fee row together with its transfer. */
async function cascadeTransferFeeDeletedAt(
  tx: DbTransaction,
  userId: string,
  transferId: string,
  deletedAt: string | null,
): Promise<void> {
  const fee = await tx.orm.public.Transaction.where({ transferId, userId }).first();
  if (fee === null) return;
  if (fee.deletedAt === deletedAt) return;

  const after = await tx.orm.public.Transaction.where({ id: fee.id, userId }).update({
    deletedAt,
  });
  if (after === null) return;

  await writeAudit(tx, {
    userId,
    entityType: "Transaction",
    entityId: fee.id,
    action: deletedAt === null ? "RESTORE" : "SOFT_DELETE",
    before: fee,
    after,
  });
  await writeOutbox(tx, {
    userId,
    aggregateType: "Transaction",
    aggregateId: fee.id,
    eventType: deletedAt === null ? "transaction.restored" : "transaction.deleted",
    payload: after,
  });
}

async function assertCategoryKind(
  tx: DbTransaction,
  userId: string,
  categoryId: string | null,
  type: CashflowType,
): Promise<void> {
  if (categoryId === null) return;
  const category = await tx.orm.public.Category.where({ id: categoryId, userId }).first();
  if (category === null) throw new LedgerError("VALIDATION", "Kategori tidak ditemukan.");
  if (category.kind !== type) {
    throw new LedgerError("VALIDATION", "Kategori tidak sesuai dengan jenis transaksi.");
  }
}

function mapTransaction(row: TransactionRow): TransactionSummary {
  return {
    id: row.id,
    type: row.type,
    amount: BigInt(row.amount),
    accountId: row.accountId,
    accountName: row.accountName,
    destinationAccountId: row.destinationAccountId,
    destinationAccountName: row.destinationAccountName,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    planItemId: row.planItemId,
    planItemLabel: row.planItemLabel,
    planId: row.planId,
    planName: row.planName,
    transferId: row.transferId,
    transferFeeId: row.transferFeeId,
    transferFeeAmount: row.transferFeeAmount === null ? null : BigInt(row.transferFeeAmount),
    merchant: row.merchant,
    counterparty: row.counterparty,
    note: row.note,
    occurredAt: parseDbTimestamp(row.occurredAt).toISOString(),
    occurredOn: row.occurredOn,
    source: row.source,
    clientRequestId: row.clientRequestId,
    createdAt: parseDbTimestamp(row.createdAt).toISOString(),
    updatedAt: parseDbTimestamp(row.updatedAt).toISOString(),
    deletedAt: row.deletedAt === null ? null : parseDbTimestamp(row.deletedAt).toISOString(),
    allocated: BigInt(row.allocated),
    allocationCount: Number(row.allocationCount),
    attachmentCount: Number(row.attachmentCount),
  };
}
