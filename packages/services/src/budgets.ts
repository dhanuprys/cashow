import {
  type BudgetPeriod,
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
  period: BudgetPeriod;
  startDate: string | null;
  endDate: string | null;
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
        period: (row.period as BudgetPeriod) ?? "MONTHLY",
        startDate: row.startDate,
        endDate: row.endDate,
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
      period: data.period,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
    });
    const summary = await getBudget(ctx, created.id);
    if (summary === null) throw new LedgerError("INTERNAL", "Anggaran gagal dibaca kembali.");
    await writeAudit(ctx.db, {
      userId: ctx.userId,
      entityType: "Budget",
      entityId: created.id,
      action: "CREATE",
      after: { name: created.name, amount: created.amount, period: created.period },
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
    if (data.period !== undefined) patch.period = data.period;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
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
    period: (row.period as BudgetPeriod) ?? "MONTHLY",
    startDate: row.startDate,
    endDate: row.endDate,
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
      from: string;
      to: string;
      dailyPacing: bigint;
      transactionCount: number;
      isExpired?: boolean;
    }>
  >
> {
  try {
    const settings = await userSettings(ctx);
    const now = nowOf(ctx);
    const today = toLocalDate(now, settings.timezone);

    const budgets = await listBudgets(ctx);
    if (!budgets.ok) return budgets;
    const liveBudgets = budgets.value.filter((budget) => budget.active);

    const result = [];
    if (liveBudgets.length > 0) {
      // 1. Compute individual active date ranges per budget
      const budgetRanges = liveBudgets.map((b) => {
        if (b.period === "WEEKLY") {
          return computeWeeklyRange(now, settings.timezone, settings.weekStartsOn);
        }
        if (b.period === "CUSTOM" && b.startDate && b.endDate) {
          return { from: b.startDate, to: b.endDate };
        }
        return budgetMonthRange(now, settings.timezone, settings.budgetMonthStartDay);
      });

      // 2. Compute outer bounding box across all active budgets
      let minFrom = budgetRanges[0]?.from ?? today;
      let maxTo = budgetRanges[0]?.to ?? today;
      for (const r of budgetRanges) {
        if (r.from < minFrom) minFrom = r.from;
        if (r.to > maxTo) maxTo = r.to;
      }

      // 3. Load all categories for user to resolve parent-child hierarchy
      const allCategories = await ctx.db.orm.public.Category.where({ userId: ctx.userId })
        .select("id", "parentId")
        .all();

      const childrenByParent = new Map<string, Set<string>>();
      for (const cat of allCategories) {
        if (cat.parentId !== null) {
          let set = childrenByParent.get(cat.parentId);
          if (!set) {
            set = new Set<string>();
            childrenByParent.set(cat.parentId, set);
          }
          set.add(cat.id);
        }
      }

      function getAllDescendants(parentId: string): Set<string> {
        const descendants = new Set<string>();
        const queue = [parentId];
        while (queue.length > 0) {
          const current = queue.shift();
          if (!current) continue;
          const directChildren = childrenByParent.get(current);
          if (directChildren) {
            for (const childId of directChildren) {
              if (!descendants.has(childId)) {
                descendants.add(childId);
                queue.push(childId);
              }
            }
          }
        }
        return descendants;
      }

      // 4. Query all expense transactions in the single bounding-box range in 1 round-trip
      const expensesPlan = ctx.db.raw.sql`
        SELECT t."id" AS id,
               t."categoryId" AS "categoryId",
               t."amount"::text AS amount,
               t."occurredOn"::text AS "occurredOn"
        FROM "public"."Transaction" t
        JOIN "public"."Account" acc ON acc."id" = t."accountId"
        WHERE t."userId" = ${ctx.userId}
          AND t."deletedAt" IS NULL
          AND t."type" = 'EXPENSE'
          AND (acc."currency" = 'IDR' OR acc."currency" IS NULL)
          AND t."occurredOn" >= ${minFrom}::date
          AND t."occurredOn" <= ${maxTo}::date
      `
        .returnsRow({
          id: "pg/text@1",
          categoryId: { codecId: "pg/text@1", nullable: true },
          amount: "pg/text@1",
          occurredOn: "pg/text@1",
        })
        .build();
      const expenseRows = await ctx.db.query(expensesPlan);

      // 5. Evaluate each budget against its own specific date range and categories
      for (let i = 0; i < liveBudgets.length; i++) {
        const budget = liveBudgets[i];
        const range = budgetRanges[i];
        if (!budget || !range) continue;

        const targetCatIds =
          budget.categoryId === null
            ? null
            : (() => {
                const s = getAllDescendants(budget.categoryId);
                s.add(budget.categoryId);
                return s;
              })();

        let spent = 0n;
        let txCount = 0;

        for (const row of expenseRows) {
          if (row.occurredOn < range.from || row.occurredOn > range.to) continue;
          if (
            targetCatIds === null ||
            (row.categoryId !== null && targetCatIds.has(row.categoryId))
          ) {
            spent += BigInt(row.amount);
            txCount += 1;
          }
        }

        const elapsed = Math.max(1, daysBetweenLocal(range.from, now, settings.timezone));
        const totalDays = Math.max(
          1,
          daysBetweenLocal(range.from, toDateLocal(range.to), settings.timezone) + 1,
        );
        const daysRemaining = Math.max(0, totalDays - elapsed);
        const isExpired = today > range.to;

        const remaining = budget.amount - spent;
        const projected = isExpired
          ? spent
          : (spent * BigInt(totalDays)) / BigInt(Math.min(elapsed, totalDays));
        const usedPercent =
          budget.amount === 0n ? 0 : Number((spent * 10000n) / budget.amount) / 100;
        const dailyPacing =
          !isExpired && remaining > 0n && daysRemaining > 0
            ? remaining / BigInt(daysRemaining)
            : 0n;

        result.push({
          budget,
          spent,
          remaining,
          usedPercent,
          projected,
          daysElapsed: Math.min(elapsed, totalDays),
          totalDays,
          monthElapsedPercent: Math.min(
            100,
            Math.round((Math.min(elapsed, totalDays) / totalDays) * 100),
          ),
          from: range.from,
          to: range.to,
          dailyPacing,
          transactionCount: txCount,
          isExpired,
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

function computeWeeklyRange(
  now: Date,
  timeZone: string,
  weekStartsOn: number,
): { from: string; to: string } {
  const today = toLocalDate(now, timeZone);
  const jsDay = new Date(`${today}T00:00:00Z`).getUTCDay();
  let diff = jsDay - weekStartsOn;
  if (diff < 0) diff += 7;

  const startMs = Date.parse(`${today}T00:00:00Z`) - diff * 86_400_000;
  const endMs = startMs + 6 * 86_400_000;

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  const from = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}-${String(startDate.getUTCDate()).padStart(2, "0")}`;
  const to = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

  return { from, to };
}
