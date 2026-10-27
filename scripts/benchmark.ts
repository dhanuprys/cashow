/**
 * Phase 0 performance gate (plan §8).
 *
 * Measures the dashboard read path and transaction creation against the
 * 100,000-row seed. Budgets:
 *
 *   dashboard queries (p95)      under 100 ms
 *   create transaction (p95)     under 150 ms
 *
 *   bun run seed && bun run bench
 *
 * Exits non-zero when a budget is missed, so the nightly CI job catches a
 * regression before it is felt. Numbers are local-server timings; adjust the
 * budgets only with a recorded ADR.
 */
import { db } from "@cashow/db";
import { toLocalDate } from "@cashow/domain";

const BENCHMARK_EMAIL = "benchmark@cashow.test";
const READ_SAMPLES = 20;
const WRITE_SAMPLES = 60;
const READ_BUDGET_MS = 100;
const WRITE_BUDGET_MS = 150;

type Measurement = {
  name: string;
  unit: "ms";
  samples: number;
  min: number;
  median: number;
  p95: number;
  max: number;
  budget: number;
  passed: boolean;
  rows?: number;
};

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function summarize(name: string, durations: number[], budget: number, rows?: number): Measurement {
  const sorted = [...durations].sort((a, b) => a - b);
  const p95 = percentile(sorted, 0.95);
  return {
    name,
    unit: "ms",
    samples: durations.length,
    min: round(Math.min(...sorted)),
    median: round(percentile(sorted, 0.5)),
    p95: round(p95),
    max: round(Math.max(...sorted)),
    budget,
    passed: p95 <= budget,
    ...(rows === undefined ? {} : { rows }),
  };
}

async function measureRead(name: string, run: () => Promise<number>): Promise<Measurement> {
  // Warm the plan/cache path once before timing.
  const warmRows = await run();
  const durations: number[] = [];
  for (let index = 0; index < READ_SAMPLES; index += 1) {
    const startedAt = performance.now();
    await run();
    durations.push(performance.now() - startedAt);
  }
  return summarize(name, durations, READ_BUDGET_MS, warmRows);
}

async function main(): Promise<void> {
  const user = await db.orm.public.User.where({ email: BENCHMARK_EMAIL }).first();
  if (user === null) {
    throw new Error("Benchmark owner not found. Run `bun run seed` first.");
  }

  const transactionCountPlan = db.raw
    .sql`SELECT count(*)::bigint AS count FROM "public"."Transaction" WHERE "userId" = ${user.id}`
    .returnsRow({ count: "pg/int8@1" })
    .build();
  const transactionCount = await db.query(transactionCountPlan);
  const total = Number(transactionCount[0]?.count ?? 0n);

  // Two-branch aggregate, not `JOIN ... ON (accountId = a OR destinationAccountId = a)`:
  // an OR join cannot use one index for both sides. Splitting the source and
  // destination moves lets the planner use `Transaction_userId_idx` (plan §8,
  // optimization ladder step 1).
  const balancesPlan = db.raw.sql`
    SELECT a."name" AS name,
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
        FROM "public"."Transaction" t
        WHERE t."userId" = ${user.id} AND t."deletedAt" IS NULL
        UNION ALL
        SELECT "destinationAccountId" AS id, "amount" AS delta
        FROM "public"."Transaction" t
        WHERE t."userId" = ${user.id} AND t."deletedAt" IS NULL
          AND t."type" = 'TRANSFER' AND t."destinationAccountId" IS NOT NULL
      ) x
      GROUP BY x.id
    ) m ON m.id = a."id"
    WHERE a."userId" = ${user.id}
    ORDER BY a."name"`
    .returnsRow({ name: "pg/text@1", balance: "pg/text@1" })
    .build();

  const cashflowPlan = db.raw.sql`
    SELECT to_char(date_trunc('month', t."occurredOn"), 'YYYY-MM') AS bucket,
           COALESCE(c."name", 'Tanpa kategori') AS category,
           SUM(CASE WHEN t."type" = 'INCOME' THEN t."amount" ELSE 0 END)::text AS income,
           SUM(CASE WHEN t."type" = 'EXPENSE' THEN t."amount" ELSE 0 END)::text AS expense
    FROM "public"."Transaction" t
    LEFT JOIN "public"."Category" c ON c."id" = t."categoryId"
    WHERE t."userId" = ${user.id}
      AND t."deletedAt" IS NULL
      AND t."occurredOn" >= (CURRENT_DATE - INTERVAL '12 months')
      AND t."type" IN ('INCOME', 'EXPENSE')
    GROUP BY 1, 2
    ORDER BY 1 DESC, 2`
    .returnsRow({
      bucket: "pg/text@1",
      category: "pg/text@1",
      income: "pg/text@1",
      expense: "pg/text@1",
    })
    .build();

  const recentPlan = db.raw.sql`
    SELECT t."id" AS id, t."type" AS type, t."amount"::text AS amount,
           t."occurredOn"::text AS "occurredOn", t."note" AS note
    FROM "public"."Transaction" t
    WHERE t."userId" = ${user.id} AND t."deletedAt" IS NULL
    ORDER BY t."occurredAt" DESC
    LIMIT 20`
    .returnsRow({
      id: "pg/text@1",
      type: "pg/text@1",
      amount: "pg/text@1",
      occurredOn: "pg/text@1",
      note: { codecId: "pg/text@1", nullable: true },
    })
    .build();

  const allocationsPlan = db.raw.sql`
    SELECT i."id" AS id, i."amount"::text AS amount,
           COALESCE(SUM(a."amount"), 0)::text AS allocated
    FROM "public"."Transaction" i
    LEFT JOIN "public"."Allocation" a ON a."incomeId" = i."id"
    WHERE i."userId" = ${user.id} AND i."type" = 'INCOME' AND i."deletedAt" IS NULL
    GROUP BY i."id", i."amount", i."occurredAt"
    ORDER BY i."occurredAt" DESC
    LIMIT 20`
    .returnsRow({
      id: "pg/text@1",
      amount: "pg/text@1",
      allocated: "pg/text@1",
    })
    .build();

  const balanceRows = await db.query(balancesPlan);
  const cashflowRows = await db.query(cashflowPlan);
  const recentRows = await db.query(recentPlan);
  const allocationRows = await db.query(allocationsPlan);

  const reads: Measurement[] = [
    await measureRead("balances", async () => (await db.query(balancesPlan)).length),
    await measureRead("monthly-cashflow", async () => (await db.query(cashflowPlan)).length),
    await measureRead("recent-transactions", async () => (await db.query(recentPlan)).length),
    await measureRead("allocation-outstanding", async () => {
      return (await db.query(allocationsPlan)).length;
    }),
  ];

  const account = await db.orm.public.Account.where({ userId: user.id }).first();
  const category = await db.orm.public.Category.where({ userId: user.id, kind: "EXPENSE" }).first();
  if (account === null || category === null) {
    throw new Error("Benchmark owner has no account or expense category.");
  }

  const now = new Date();
  const occurredOn = toLocalDate(now, user.timezone);
  const writeDurations: number[] = [];
  const createdIds: string[] = [];

  for (let index = 0; index < WRITE_SAMPLES; index += 1) {
    const startedAt = performance.now();
    const created = await db.orm.public.Transaction.create({
      userId: user.id,
      type: "EXPENSE",
      amount: BigInt(25_000 + index * 1_000),
      accountId: account.id,
      categoryId: category.id,
      note: `benchmark ${index}`,
      occurredAt: now.toISOString(),
      occurredOn,
      source: "MANUAL",
    });
    writeDurations.push(performance.now() - startedAt);
    createdIds.push(created.id);
  }

  for (const id of createdIds) {
    await db.orm.public.Transaction.where({ id }).delete();
  }

  const writes = [summarize("create-expense", writeDurations, WRITE_BUDGET_MS)];

  // Sanity: the trigger invariants held across 20,000 allocations.
  const violationsPlan = db.raw.sql`
    SELECT count(*)::bigint AS count FROM (
      SELECT a."expenseId" AS id, SUM(a."amount") AS allocated
      FROM "public"."Allocation" a WHERE a."userId" = ${user.id}
      GROUP BY a."expenseId"
    ) x JOIN "public"."Transaction" t ON t."id" = x.id
    WHERE x.allocated > t."amount"`
    .returnsRow({ count: "pg/int8@1" })
    .build();
  const incomeViolationsPlan = db.raw.sql`
    SELECT count(*)::bigint AS count FROM (
      SELECT a."incomeId" AS id, SUM(a."amount") AS allocated
      FROM "public"."Allocation" a WHERE a."userId" = ${user.id}
      GROUP BY a."incomeId"
    ) x JOIN "public"."Transaction" t ON t."id" = x.id
    WHERE x.allocated > t."amount"`
    .returnsRow({ count: "pg/int8@1" })
    .build();
  const violations = Number((await db.query(violationsPlan))[0]?.count ?? 0n);
  const incomeViolations = Number((await db.query(incomeViolationsPlan))[0]?.count ?? 0n);

  const measurements = [...reads, ...writes];
  const passed =
    measurements.every((measurement) => measurement.passed) && violations + incomeViolations === 0;

  console.log(
    JSON.stringify(
      {
        dataset: {
          user: BENCHMARK_EMAIL,
          transactions: total,
          accounts: balanceRows.length,
          months: new Set(cashflowRows.map((row) => row.bucket)).size,
          recentRows: recentRows.length,
          allocationRows: allocationRows.length,
        },
        budgets: {
          readP95Ms: READ_BUDGET_MS,
          writeP95Ms: WRITE_BUDGET_MS,
        },
        measurements,
        allocationViolations: { expense: violations, income: incomeViolations },
        passed,
      },
      null,
      2,
    ),
  );

  if (!passed) process.exitCode = 1;
}

await main();
await db.close();
