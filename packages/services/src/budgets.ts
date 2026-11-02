import {
  budgetInputSchema,
  budgetUpdateSchema,
  firstIssue,
  toLocalDate,
  zonedToUtc,
} from "@cashow/domain";

import { writeAudit } from "./audit";
import { nowOf, type UseCaseContext, userSettings } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";

export interface BudgetSummary {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: bigint;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listBudgets(ctx: UseCaseContext): Promise<Result<BudgetSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.Budget.where({ userId: ctx.userId }).all();
    const categories = await ctx.db.orm.public.Category.where({ userId: ctx.userId })
      .select("id", "name")
      .all();
    const byId = new Map(categories.map((category) => [category.id, category.name]));
    return ok(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryId: row.categoryId,
        categoryName: row.categoryId === null ? null : (byId.get(row.categoryId) ?? null),
        amount: BigInt(row.amount),
        active: row.active,
        createdAt: String(row.createdAt),
        updatedAt: String(row.updatedAt),
      })),
    );
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createBudget(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<BudgetSummary>> {
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const created = await ctx.db.orm.public.Budget.create({
      userId: ctx.userId,
      name: data.name,
      categoryId: data.categoryId,
      amount: data.amount,
    });
    const summary = await getBudget(ctx, created.id);
    if (summary === null) throw new LedgerError("INTERNAL", "Anggaran gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Budget",
      entityId: created.id,
      action: "CREATE",
      after: { name: created.name, amount: created.amount },
    });
    return ok(summary);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateBudget(
  ctx: UseCaseContext,
  budgetId: string,
  input: unknown,
): Promise<Result<BudgetSummary>> {
  const parsed = budgetUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }
  const data = parsed.data;

  try {
    const before = await ctx.db.orm.public.Budget.where({
      id: budgetId,
      userId: ctx.userId,
    }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Anggaran tidak ditemukan."));

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.active !== undefined) patch.active = data.active;

    if (Object.keys(patch).length > 0) {
      await ctx.db.orm.public.Budget.where({ id: budgetId, userId: ctx.userId }).update(patch);
    }

    const after = await getBudget(ctx, budgetId);
    if (after === null) throw new LedgerError("INTERNAL", "Anggaran gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Budget",
      entityId: budgetId,
      action: "UPDATE",
      before,
      after,
    });
    return ok(after);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deleteBudget(ctx: UseCaseContext, budgetId: string): Promise<Result<void>> {
  try {
    const before = await ctx.db.orm.public.Budget.where({
      id: budgetId,
      userId: ctx.userId,
    }).first();
    if (before === null) return err(new LedgerError("NOT_FOUND", "Anggaran tidak ditemukan."));
    await ctx.db.orm.public.Budget.where({ id: budgetId, userId: ctx.userId }).deleteAll();
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Budget",
      entityId: budgetId,
      action: "SOFT_DELETE",
      before,
      after: null,
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

async function getBudget(ctx: UseCaseContext, budgetId: string): Promise<BudgetSummary | null> {
  const row = await ctx.db.orm.public.Budget.where({ id: budgetId, userId: ctx.userId }).first();
  if (row === null) return null;
  let categoryName: string | null = null;
  if (row.categoryId !== null) {
    const category = await ctx.db.orm.public.Category.where({
      id: row.categoryId,
      userId: ctx.userId,
    }).first();
    categoryName = category?.name ?? null;
  }
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName,
    amount: BigInt(row.amount),
    active: row.active,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export async function getBudgetStatus(
  ctx: UseCaseContext,
  _options: { now?: Date } = {},
): Promise<
  Result<
    Array<{
      budget: BudgetSummary;
      spent: bigint;
      remaining: bigint;
      usedPercent: number;
      projected: bigint;
      daysElapsed: number;
      totalDays: number;
      monthElapsedPercent: number;
    }>
  >
> {
  try {
    const settings = await userSettings(ctx);
    const now = nowOf(ctx);
    const { from, to } = budgetMonthRange(now, settings.timezone, settings.budgetMonthStartDay);

    const budgets = await listBudgets(ctx);
    if (!budgets.ok) return budgets;
    const liveBudgets = budgets.value.filter((budget) => budget.active);

    const result = [];
    if (liveBudgets.length > 0) {
      const expensesPlan = ctx.db.raw.sql`
        SELECT t."categoryId" AS "categoryId",
               COALESCE(SUM(t."amount"), 0)::text AS total
        FROM "public"."Transaction" t
        WHERE t."userId" = ${ctx.userId}
          AND t."deletedAt" IS NULL
          AND t."type" = 'EXPENSE'
          AND t."occurredOn" >= ${from}::date
          AND t."occurredOn" <= ${to}::date
        GROUP BY t."categoryId"
      `
        .returnsRow({
          categoryId: { codecId: "pg/text@1", nullable: true },
          total: "pg/text@1",
        })
        .build();
      const expenseRows = await ctx.db.query(expensesPlan);

      const categoryTotals = new Map<string, bigint>();
      let overallExpense = 0n;
      for (const row of expenseRows) {
        const total = BigInt(row.total);
        overallExpense += total;
        if (row.categoryId !== null) {
          categoryTotals.set(row.categoryId, total);
        }
      }

      const elapsed = Math.max(1, daysBetweenLocal(from, now, settings.timezone));
      const totalDays = Math.max(1, daysBetweenLocal(from, toDateLocal(to), settings.timezone) + 1);

      for (const budget of liveBudgets) {
        const spent =
          budget.categoryId === null
            ? overallExpense
            : (categoryTotals.get(budget.categoryId) ?? 0n);
        const remaining = budget.amount - spent;
        const projected = (spent * BigInt(totalDays)) / BigInt(elapsed);
        const usedPercent =
          budget.amount === 0n ? 0 : Number((spent * 10000n) / budget.amount) / 100;
        result.push({
          budget,
          spent,
          remaining,
          usedPercent,
          projected,
          daysElapsed: elapsed,
          totalDays,
          monthElapsedPercent: Math.min(100, Math.round((elapsed / totalDays) * 100)),
        });
      }
    }
    return ok(result);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function budgetMonthRange(
  now: Date,
  timeZone: string,
  startDay: number,
): { from: string; to: string } {
  const today = toLocalDate(now, timeZone);
  const [yearText, monthText, dayText] = today.split("-");
  let year = Number(yearText);
  let month = Number(monthText);
  const day = Number(dayText);

  if (day < startDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  const from = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(startDay, daysInMonth(year, month))).padStart(2, "0")}`;
  // to = day before next start
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextStartDay = Math.min(startDay, daysInMonth(nextYear, nextMonth));
  const nextStart = zonedToUtc(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextStartDay).padStart(2, "0")}T00:00:00`,
    timeZone,
  );
  const lastDay = new Date(nextStart.getTime() - 86_400_000);
  const to = toLocalDate(lastDay, timeZone);
  return { from, to };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function daysBetweenLocal(from: string, date: Date, timeZone: string): number {
  const to = toLocalDate(date, timeZone);
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function toDateLocal(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
