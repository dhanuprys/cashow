import { type LocalDate, toLocalDate } from "@cashow/domain";
import { getBudgetStatus } from "./budgets";
import { nowOf, type UseCaseContext, userSettings } from "./context";
import { toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";

export type SummaryPeriod =
  | "today"
  | "week"
  | "month"
  | "budgetMonth"
  | "last7"
  | "last30"
  | "custom";

export interface SummaryRange {
  from: LocalDate;
  to: LocalDate;
}

export interface SummaryCategoryRow {
  categoryId: string | null;
  name: string;
  total: bigint;
}

export interface SummaryAccountRow {
  accountId: string;
  name: string;
  income: bigint;
  expense: bigint;
  net: bigint;
}

export interface SummaryMerchantRow {
  merchant: string;
  total: bigint;
}

export interface SummaryDayRow {
  date: LocalDate;
  income: bigint;
  expense: bigint;
}

export interface Summary {
  range: SummaryRange;
  income: bigint;
  expense: bigint;
  net: bigint;
  transactionCount: number;
  byCategory: SummaryCategoryRow[];
  byAccount: SummaryAccountRow[];
  topMerchants: SummaryMerchantRow[];
  daily: SummaryDayRow[];
  previous: { income: bigint; expense: bigint; net: bigint } | null;
}

export interface SummaryOptions {
  period?: SummaryPeriod;
  from?: LocalDate;
  to?: LocalDate;
  accountId?: string;
}

export interface SafeToSpend {
  daily: bigint;
  daysLeft: number;
  upcoming: bigint;
  available: bigint;
}

export async function getSafeToSpend(ctx: UseCaseContext): Promise<Result<SafeToSpend>> {
  try {
    const settings = await userSettings(ctx);
    const now = nowOf(ctx);
    const timezone = settings.timezone;
    const budgetStartDay = settings.budgetMonthStartDay;
    const range = budgetMonthRange(now, timezone, budgetStartDay);

    const today = toLocalDate(now, timezone);
    const endMs = Date.parse(`${range.to}T00:00:00Z`);
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const daysLeft = Math.max(1, Math.round((endMs - todayMs) / 86_400_000) + 1);

    // Upcoming recurring expenses in the rest of the budget month.
    const templates = await ctx.db.orm.public.RecurringTemplate.where({
      userId: ctx.userId,
      active: true,
    }).all();
    let upcoming = 0n;
    for (const template of templates) {
      if (template.type === "EXPENSE") upcoming += BigInt(template.amount);
    }

    const summaryResult = await getSummary(ctx, { period: "budgetMonth" });
    const summary = summaryResult.ok ? summaryResult.value : null;
    const free = summary === null ? 0n : summary.income - summary.expense;

    // Prefer budget remaining when budgets exist (only routine MONTHLY/WEEKLY, exclude temporary CUSTOM projects).
    const budgetStatus = await getBudgetStatus(ctx);
    let available = free;
    if (budgetStatus.ok && budgetStatus.value.length > 0) {
      const routineBudgets = budgetStatus.value.filter((item) => item.budget.period !== "CUSTOM");
      if (routineBudgets.length > 0) {
        available = routineBudgets.reduce((sum, item) => sum + item.remaining, 0n);
      }
    }
    available -= upcoming;

    const daily = available >= 0n ? available / BigInt(daysLeft) : 0n;
    return ok({ daily, daysLeft, upcoming, available });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getSummary(
  ctx: UseCaseContext,
  options: SummaryOptions = {},
): Promise<Result<Summary>> {
  try {
    const settings = await userSettings(ctx);
    const timezone = settings.timezone;
    const now = nowOf(ctx);
    const budgetStartDay = settings.budgetMonthStartDay;
    const weekStartsOn = settings.weekStartsOn;

    const period = options.period ?? "month";
    const range = periodRange(
      period,
      now,
      timezone,
      budgetStartDay,
      weekStartsOn,
      options.from,
      options.to,
    );
    const accountFilter = options.accountId ?? "";

    const totals = await loadTotals(ctx, range, accountFilter);
    const byCategory = await loadByCategory(ctx, range, accountFilter);
    const byAccount = await loadByAccount(ctx, range, accountFilter);
    const topMerchants = await loadTopMerchants(ctx, range, accountFilter);
    const daily = await loadDaily(ctx, range, accountFilter);

    // Previous equivalent period: shift the range back by its own length.
    const prevRange = previousRange(range);
    const previousTotals = await loadTotals(ctx, prevRange, accountFilter);

    return ok({
      range,
      income: totals.income,
      expense: totals.expense,
      net: totals.income - totals.expense,
      transactionCount: totals.transactionCount,
      byCategory,
      byAccount,
      topMerchants,
      daily,
      previous: {
        income: previousTotals.income,
        expense: previousTotals.expense,
        net: previousTotals.income - previousTotals.expense,
      },
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export function periodRange(
  period: SummaryPeriod,
  now: Date,
  timeZone: string,
  budgetStartDay: number,
  weekStartsOn: number,
  from?: LocalDate,
  to?: LocalDate,
): SummaryRange {
  const today = toLocalDate(now, timeZone);

  if (period === "today") return { from: today, to: today };
  if (period === "last7") {
    const start = shiftDate(today, -6);
    return { from: start, to: today };
  }
  if (period === "last30") {
    const start = shiftDate(today, -29);
    return { from: start, to: today };
  }
  if (period === "week") {
    const start = startOfWeek(today, weekStartsOn);
    const end = shiftDate(start, 6);
    return { from: start, to: end };
  }
  if (period === "month") {
    const [year, month] = today.split("-").map(Number) as [number, number];
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = daysInMonth(year, month);
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }
  if (period === "budgetMonth") {
    return budgetMonthRange(now, timeZone, budgetStartDay);
  }
  if (period === "custom" && from !== undefined && to !== undefined) {
    return from <= to ? { from, to } : { from: to, to: from };
  }
  // Default to current month.
  const [year, month] = today.split("-").map(Number) as [number, number];
  const fromDefault = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDefault = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  return { from: fromDefault, to: toDefault };
}

// ---------------------------------------------------------------------------
// SQL loaders
// ---------------------------------------------------------------------------

async function loadTotals(
  ctx: UseCaseContext,
  range: SummaryRange,
  accountFilter: string,
): Promise<{ income: bigint; expense: bigint; transactionCount: number }> {
  const plan = ctx.db.raw.sql`
    SELECT COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END), 0)::text AS income,
           COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END), 0)::text AS expense,
           count(*)::text AS "transactionCount"
    FROM "public"."Transaction" t
    WHERE t."userId" = ${ctx.userId}
      AND t."deletedAt" IS NULL
      AND t."type" IN ('INCOME', 'EXPENSE')
      AND t."occurredOn" >= ${range.from}::date
      AND t."occurredOn" <= ${range.to}::date
      AND (${accountFilter} = '' OR t."accountId" = ${accountFilter})
  `
    .returnsRow({ income: "pg/text@1", expense: "pg/text@1", transactionCount: "pg/text@1" })
    .build();
  const rows = await ctx.db.query(plan);
  const row = rows[0];
  return {
    income: BigInt(row?.income ?? "0"),
    expense: BigInt(row?.expense ?? "0"),
    transactionCount: Number(row?.transactionCount ?? "0"),
  };
}

async function loadByCategory(
  ctx: UseCaseContext,
  range: SummaryRange,
  accountFilter: string,
): Promise<SummaryCategoryRow[]> {
  const plan = ctx.db.raw.sql`
    SELECT t."categoryId" AS "categoryId",
           COALESCE(c."name", 'Tanpa kategori') AS name,
           SUM(t."amount")::text AS total
    FROM "public"."Transaction" t
    LEFT JOIN "public"."Category" c ON c."id" = t."categoryId"
    WHERE t."userId" = ${ctx.userId}
      AND t."deletedAt" IS NULL
      AND t."type" = 'EXPENSE'
      AND t."occurredOn" >= ${range.from}::date
      AND t."occurredOn" <= ${range.to}::date
      AND (${accountFilter} = '' OR t."accountId" = ${accountFilter})
    GROUP BY t."categoryId", c."name"
    ORDER BY SUM(t."amount") DESC
  `
    .returnsRow({
      categoryId: { codecId: "pg/text@1", nullable: true },
      name: "pg/text@1",
      total: "pg/text@1",
    })
    .build();
  const rows = await ctx.db.query(plan);
  return rows.map((row) => ({
    categoryId: row.categoryId,
    name: row.name,
    total: BigInt(row.total),
  }));
}

async function loadByAccount(
  ctx: UseCaseContext,
  range: SummaryRange,
  accountFilter: string,
): Promise<SummaryAccountRow[]> {
  const plan = ctx.db.raw.sql`
    SELECT t."accountId" AS "accountId",
           a."name" AS name,
           COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END), 0)::text AS income,
           COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END), 0)::text AS expense
    FROM "public"."Transaction" t
    JOIN "public"."Account" a ON a."id" = t."accountId"
    WHERE t."userId" = ${ctx.userId}
      AND t."deletedAt" IS NULL
      AND t."type" IN ('INCOME', 'EXPENSE')
      AND t."occurredOn" >= ${range.from}::date
      AND t."occurredOn" <= ${range.to}::date
      AND (${accountFilter} = '' OR t."accountId" = ${accountFilter})
    GROUP BY t."accountId", a."name"
    ORDER BY a."name"
  `
    .returnsRow({
      accountId: "pg/text@1",
      name: "pg/text@1",
      income: "pg/text@1",
      expense: "pg/text@1",
    })
    .build();
  const rows = await ctx.db.query(plan);
  return rows.map((row) => {
    const income = BigInt(row.income);
    const expense = BigInt(row.expense);
    return { accountId: row.accountId, name: row.name, income, expense, net: income - expense };
  });
}

async function loadTopMerchants(
  ctx: UseCaseContext,
  range: SummaryRange,
  accountFilter: string,
): Promise<SummaryMerchantRow[]> {
  const plan = ctx.db.raw.sql`
    SELECT COALESCE(t."merchant", '(tanpa nama)') AS merchant,
           SUM(t."amount")::text AS total
    FROM "public"."Transaction" t
    WHERE t."userId" = ${ctx.userId}
      AND t."deletedAt" IS NULL
      AND t."type" = 'EXPENSE'
      AND t."occurredOn" >= ${range.from}::date
      AND t."occurredOn" <= ${range.to}::date
      AND (${accountFilter} = '' OR t."accountId" = ${accountFilter})
      AND t."merchant" IS NOT NULL
    GROUP BY t."merchant"
    ORDER BY SUM(t."amount") DESC
    LIMIT 8
  `
    .returnsRow({ merchant: "pg/text@1", total: "pg/text@1" })
    .build();
  const rows = await ctx.db.query(plan);
  return rows.map((row) => ({ merchant: row.merchant, total: BigInt(row.total) }));
}

async function loadDaily(
  ctx: UseCaseContext,
  range: SummaryRange,
  accountFilter: string,
): Promise<SummaryDayRow[]> {
  const plan = ctx.db.raw.sql`
    SELECT t."occurredOn"::text AS date,
           COALESCE(SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END), 0)::text AS income,
           COALESCE(SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END), 0)::text AS expense
    FROM "public"."Transaction" t
    WHERE t."userId" = ${ctx.userId}
      AND t."deletedAt" IS NULL
      AND t."type" IN ('INCOME', 'EXPENSE')
      AND t."occurredOn" >= ${range.from}::date
      AND t."occurredOn" <= ${range.to}::date
      AND (${accountFilter} = '' OR t."accountId" = ${accountFilter})
    GROUP BY t."occurredOn"
    ORDER BY t."occurredOn"
  `
    .returnsRow({ date: "pg/text@1", income: "pg/text@1", expense: "pg/text@1" })
    .build();
  const rows = await ctx.db.query(plan);
  return rows.map((row) => ({
    date: row.date as LocalDate,
    income: BigInt(row.income),
    expense: BigInt(row.expense),
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function budgetMonthRange(now: Date, timeZone: string, startDay: number): SummaryRange {
  const today = toLocalDate(now, timeZone);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  let year = y;
  let month = m;
  if (d < startDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  const fromDay = Math.min(startDay, daysInMonth(year, month));
  const from = `${year}-${String(month).padStart(2, "0")}-${String(fromDay).padStart(2, "0")}`;
  let nm = month + 1;
  let ny = year;
  if (nm === 13) {
    nm = 1;
    ny += 1;
  }
  const toDay = Math.min(startDay, daysInMonth(ny, nm)) - 1;
  // to = day before next start
  let toYear = ny;
  let toMonth = nm;
  let toD = toDay;
  if (toD < 1) {
    toMonth -= 1;
    if (toMonth === 0) {
      toMonth = 12;
      toYear -= 1;
    }
    toD = daysInMonth(toYear, toMonth);
  }
  const to = `${toYear}-${String(toMonth).padStart(2, "0")}-${String(toD).padStart(2, "0")}`;
  return { from, to };
}

function startOfWeek(date: LocalDate, weekStartsOn: number): LocalDate {
  // weekStartsOn: 0=Sun..6=Sat. Convert to JS day (0=Sun..6=Sat) same.
  const jsDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  let diff = jsDay - weekStartsOn;
  if (diff < 0) diff += 7;
  return shiftDate(date, -diff);
}

function shiftDate(date: LocalDate, days: number): LocalDate {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function previousRange(range: SummaryRange): SummaryRange {
  const fromMs = Date.parse(`${range.from}T00:00:00Z`);
  const toMs = Date.parse(`${range.to}T00:00:00Z`);
  const length = Math.round((toMs - fromMs) / 86_400_000) + 1;
  const prevToMs = fromMs - 86_400_000;
  const prevFromMs = prevToMs - (length - 1) * 86_400_000;
  const prevFrom = new Date(prevFromMs);
  const prevTo = new Date(prevToMs);
  return {
    from: `${prevFrom.getUTCFullYear()}-${String(prevFrom.getUTCMonth() + 1).padStart(2, "0")}-${String(prevFrom.getUTCDate()).padStart(2, "0")}`,
    to: `${prevTo.getUTCFullYear()}-${String(prevTo.getUTCMonth() + 1).padStart(2, "0")}-${String(prevTo.getUTCDate()).padStart(2, "0")}`,
  };
}
