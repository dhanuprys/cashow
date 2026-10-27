import {
  firstIssue,
  type LocalDate,
  parseDbTimestamp,
  recurringInputSchema,
  recurringUpdateSchema,
  toLocalDate,
  toLocalDateTimeInput,
} from "@cashow/domain";
import { writeAudit } from "./audit";
import { nowOf, type UseCaseContext, userTimezone } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";
import { createTransaction, createTransfer } from "./transactions";

export interface RecurringSummary {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: bigint;
  accountId: string;
  accountName: string;
  destinationAccountId: string | null;
  destinationAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextRunAt: string;
  lastRunAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listRecurring(ctx: UseCaseContext): Promise<Result<RecurringSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.RecurringTemplate.where({ userId: ctx.userId }).all();
    const accounts = await ctx.db.orm.public.Account.where({ userId: ctx.userId }).all();
    const categories = await ctx.db.orm.public.Category.where({ userId: ctx.userId }).all();
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    return ok(
      rows.map((row) => ({
        id: row.id,
        type: row.type as "INCOME" | "EXPENSE" | "TRANSFER",
        amount: BigInt(row.amount),
        accountId: row.accountId,
        accountName: accountName.get(row.accountId) ?? "—",
        destinationAccountId: row.destinationAccountId,
        destinationAccountName:
          row.destinationAccountId === null
            ? null
            : (accountName.get(row.destinationAccountId) ?? "—"),
        categoryId: row.categoryId,
        categoryName: row.categoryId === null ? null : (categoryName.get(row.categoryId) ?? null),
        merchant: row.merchant,
        counterparty: row.counterparty,
        note: row.note,
        frequency: row.frequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
        dayOfMonth: row.dayOfMonth,
        dayOfWeek: row.dayOfWeek,
        nextRunAt: String(row.nextRunAt),
        lastRunAt: row.lastRunAt === null ? null : String(row.lastRunAt),
        active: row.active,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
      })),
    );
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createRecurring(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<RecurringSummary>> {
  const parsed = recurringInputSchema.safeParse(input);
  if (!parsed.success) return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  const data = parsed.data;

  try {
    const timezone = await userTimezone(ctx.db, ctx.userId);
    const startDate = data.startDate ?? toLocalDate(nowOf(ctx), timezone);
    const nextRunAt = zonedToUtcWall(startDate, timezone);

    const created = await ctx.db.orm.public.RecurringTemplate.create({
      userId: ctx.userId,
      type: data.type,
      amount: data.amount,
      accountId: data.accountId,
      destinationAccountId: data.destinationAccountId,
      categoryId: data.categoryId,
      merchant: data.merchant,
      counterparty: data.counterparty,
      note: data.note,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      nextRunAt: nextRunAt.toISOString(),
      active: true,
    });
    const summary = await getRecurring(ctx, created.id);
    if (summary === null)
      throw new LedgerError("INTERNAL", "Template berulang gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "RecurringTemplate",
      entityId: created.id,
      action: "CREATE",
      after: { type: created.type, amount: created.amount },
    });
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateRecurring(
  ctx: UseCaseContext,
  id: string,
  input: unknown,
): Promise<Result<RecurringSummary>> {
  const parsed = recurringUpdateSchema.safeParse(input);
  if (!parsed.success) return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  const data = parsed.data;

  try {
    const before = await ctx.db.orm.public.RecurringTemplate.where({
      id,
      userId: ctx.userId,
    }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Template tidak ditemukan."));

    const patch: Record<string, unknown> = {};
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.accountId !== undefined) patch.accountId = data.accountId;
    if (data.destinationAccountId !== undefined)
      patch.destinationAccountId = data.destinationAccountId;
    if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
    if (data.merchant !== undefined) patch.merchant = data.merchant;
    if (data.counterparty !== undefined) patch.counterparty = data.counterparty;
    if (data.note !== undefined) patch.note = data.note;
    if (data.frequency !== undefined) patch.frequency = data.frequency;
    if (data.dayOfMonth !== undefined) patch.dayOfMonth = data.dayOfMonth;
    if (data.dayOfWeek !== undefined) patch.dayOfWeek = data.dayOfWeek;
    if (data.active !== undefined) patch.active = data.active;

    if (Object.keys(patch).length > 0) {
      await ctx.db.orm.public.RecurringTemplate.where({ id, userId: ctx.userId }).update(patch);
    }

    const after = await getRecurring(ctx, id);
    if (after === null)
      throw new LedgerError("INTERNAL", "Template berulang gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "RecurringTemplate",
      entityId: id,
      action: "UPDATE",
      before,
      after,
    });
    return ok(after);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deleteRecurring(ctx: UseCaseContext, id: string): Promise<Result<void>> {
  try {
    const before = await ctx.db.orm.public.RecurringTemplate.where({
      id,
      userId: ctx.userId,
    }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Template tidak ditemukan."));
    await ctx.db.orm.public.RecurringTemplate.where({ id, userId: ctx.userId }).deleteAll();
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "RecurringTemplate",
      entityId: id,
      action: "SOFT_DELETE",
      before,
      after: null,
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** Most catch-up drafts one template may stage in a single worker tick. */
const MAX_DRAFTS_PER_TICK = 24;

/**
 * Stage due recurring occurrences as `RecurringDraft` rows (plan §5/§7).
 *
 * Nothing is committed here: the owner confirms or skips each draft on
 * `/app/recurring`, so a forgotten template can never silently move money.
 * `(templateId, runAt)` is unique, so re-running a tick is idempotent.
 */
export async function runDueRecurring(ctx: UseCaseContext): Promise<Result<number>> {
  try {
    const now = nowOf(ctx);
    const templates = await ctx.db.orm.public.RecurringTemplate.where({
      userId: ctx.userId,
      active: true,
    }).all();
    if (templates.length === 0) return ok(0);

    const _timezone = await userTimezone(ctx.db, ctx.userId);
    let staged = 0;

    for (const template of templates) {
      let nextRun = parseDbTimestamp(template.nextRunAt);
      let advanced = false;

      for (let i = 0; i < MAX_DRAFTS_PER_TICK; i += 1) {
        if (nextRun.getTime() > now.getTime()) break;

        const existing = await ctx.db.orm.public.RecurringDraft.where({
          templateId: template.id,
          runAt: nextRun.toISOString(),
        }).first();
        if (existing === null) {
          await ctx.db.orm.public.RecurringDraft.create({
            userId: ctx.userId,
            templateId: template.id,
            runAt: nextRun.toISOString(),
            type: template.type,
            amount: BigInt(template.amount),
            accountId: template.accountId,
            destinationAccountId: template.destinationAccountId,
            categoryId: template.categoryId,
            merchant: template.merchant,
            counterparty: template.counterparty,
            note: template.note,
            status: "PENDING",
          });
          staged += 1;
        }

        nextRun = advanceRun(
          nextRun,
          template.frequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
          template.dayOfMonth,
          template.dayOfWeek,
        );
        advanced = true;
      }

      if (advanced) {
        await ctx.db.orm.public.RecurringTemplate.where({
          id: template.id,
          userId: ctx.userId,
        }).update({
          nextRunAt: nextRun.toISOString(),
          lastRunAt: now.toISOString(),
        });
      }
    }

    return ok(staged);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export interface RecurringDraftSummary {
  id: string;
  templateId: string;
  templateType: "INCOME" | "EXPENSE" | "TRANSFER";
  runAt: string;
  amount: bigint;
  accountId: string;
  accountName: string;
  destinationAccountName: string | null;
  categoryName: string | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  status: string;
  transactionId: string | null;
}

/** Pending drafts the owner still has to confirm or skip. */
export async function listRecurringDrafts(
  ctx: UseCaseContext,
): Promise<Result<RecurringDraftSummary[]>> {
  try {
    const [drafts, accounts, categories] = await Promise.all([
      ctx.db.orm.public.RecurringDraft.where({ userId: ctx.userId, status: "PENDING" }).all(),
      ctx.db.orm.public.Account.where({ userId: ctx.userId }).all(),
      ctx.db.orm.public.Category.where({ userId: ctx.userId }).all(),
    ]);
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    return ok(
      drafts
        .sort((a, b) => (String(a.runAt) < String(b.runAt) ? -1 : 1))
        .map((draft) => ({
          id: draft.id,
          templateId: draft.templateId,
          templateType: draft.type as "INCOME" | "EXPENSE" | "TRANSFER",
          runAt: String(draft.runAt),
          amount: BigInt(draft.amount),
          accountId: draft.accountId,
          accountName: accountName.get(draft.accountId) ?? "—",
          destinationAccountName:
            draft.destinationAccountId === null
              ? null
              : (accountName.get(draft.destinationAccountId) ?? "—"),
          categoryName:
            draft.categoryId === null ? null : (categoryName.get(draft.categoryId) ?? null),
          merchant: draft.merchant,
          counterparty: draft.counterparty,
          note: draft.note,
          status: draft.status,
          transactionId: draft.transactionId,
        })),
    );
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/**
 * Commit a staged draft into a real transaction (or transfer).
 *
 * The draft is re-read and flipped to CONFIRMED inside the flow so two clicks
 * cannot create two transactions. `clientRequestId` is deterministic per draft,
 * which makes a retried confirm idempotent at the transaction layer too.
 */
export async function confirmRecurringDraft(
  ctx: UseCaseContext,
  id: string,
): Promise<Result<{ transactionId: string }>> {
  try {
    const draft = await ctx.db.orm.public.RecurringDraft.where({ id, userId: ctx.userId }).first();
    if (draft === null) return err(new LedgerError("NOT_FOUND", "Draf tidak ditemukan."));
    if (draft.status !== "PENDING") {
      return err(new LedgerError("CONFLICT", "Draf ini sudah diproses."));
    }

    const timezone = await userTimezone(ctx.db, ctx.userId);
    const runAt = parseDbTimestamp(draft.runAt);
    const occurredAtLocal = toLocalDateTimeInput(runAt, timezone);
    const clientRequestId = `recurring:${draft.templateId}:${runAt.toISOString()}`;

    const created =
      draft.type === "TRANSFER"
        ? await createTransfer(ctx, {
            amount: BigInt(draft.amount).toString(),
            accountId: draft.accountId,
            destinationAccountId: draft.destinationAccountId as string,
            feeAmount: "0",
            feeCategoryId: null,
            note: draft.note,
            occurredAtLocal,
            clientRequestId,
            source: "RECURRING",
          })
        : await createTransaction(ctx, {
            type: draft.type as "INCOME" | "EXPENSE",
            amount: BigInt(draft.amount).toString(),
            accountId: draft.accountId,
            categoryId: draft.categoryId,
            merchant: draft.merchant,
            counterparty: draft.counterparty,
            note: draft.note,
            occurredAtLocal,
            source: "RECURRING",
            allocations: [],
            clientRequestId,
          });
    if (!created.ok) return created;

    await ctx.db.orm.public.RecurringDraft.where({ id, userId: ctx.userId }).update({
      status: "CONFIRMED",
      transactionId: created.value.id,
      confirmedAt: nowOf(ctx).toISOString(),
    });
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "RecurringDraft",
      entityId: id,
      action: "UPDATE",
      before: { status: "PENDING" },
      after: { status: "CONFIRMED", transactionId: created.value.id },
    });

    return ok({ transactionId: created.value.id });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** Discard a staged draft without moving money. */
export async function skipRecurringDraft(ctx: UseCaseContext, id: string): Promise<Result<void>> {
  try {
    const draft = await ctx.db.orm.public.RecurringDraft.where({ id, userId: ctx.userId }).first();
    if (draft === null) return err(new LedgerError("NOT_FOUND", "Draf tidak ditemukan."));
    if (draft.status !== "PENDING") {
      return err(new LedgerError("CONFLICT", "Draf ini sudah diproses."));
    }
    await ctx.db.orm.public.RecurringDraft.where({ id, userId: ctx.userId }).update({
      status: "SKIPPED",
      skippedAt: nowOf(ctx).toISOString(),
    });
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "RecurringDraft",
      entityId: id,
      action: "UPDATE",
      before: { status: "PENDING" },
      after: { status: "SKIPPED" },
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function getRecurring(ctx: UseCaseContext, id: string): Promise<RecurringSummary | null> {
  const rows = await listRecurring(ctx);
  if (!rows.ok) return null;
  return rows.value.find((row) => row.id === id) ?? null;
}

function advanceRun(
  current: Date,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  dayOfMonth: number | null,
  _dayOfWeek: number | null,
): Date {
  const d = new Date(current.getTime());
  if (frequency === "DAILY") {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (frequency === "WEEKLY") {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (frequency === "MONTHLY") {
    const day = dayOfMonth ?? current.getUTCDate();
    let month = d.getUTCMonth() + 1;
    let year = d.getUTCFullYear();
    if (month === 12) {
      month = 0;
      year += 1;
    }
    const clamped = Math.min(day, daysInMonth(year, month + 1));
    return new Date(
      Date.UTC(year, month, clamped, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
    );
  }
  const year = d.getUTCFullYear() + 1;
  const month = d.getUTCMonth();
  const day = dayOfMonth ?? d.getUTCDate();
  const clamped = Math.min(day, daysInMonth(year, month + 1));
  return new Date(
    Date.UTC(year, month, clamped, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function zonedToUtcWall(startDate: LocalDate, timeZone: string): Date {
  const { zonedToUtc } = require("@cashow/domain") as {
    zonedToUtc: (w: string, t: string) => Date;
  };
  return zonedToUtc(`${startDate}T00:00:00`, timeZone);
}
