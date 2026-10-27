/**
 * Seed a realistic 100,000-transaction dataset over three years (plan §8).
 *
 *   bun run seed                 # create the benchmark owner + dataset
 *   SEED_RESET=1 bun run seed    # delete and rebuild it
 *   bun run seed:clean           # remove it again, reopening first-run /setup
 *
 * The seed is deterministic (fixed PRNG seed) and goes through `@cashow/db`'s
 * raw lane, so the database triggers run on every allocation. It is not part
 * of the app runtime; the benchmark script owns the read side.
 */
import { db } from "@cashow/db";
import { toLocalDate, uuidv7 } from "@cashow/domain";

const BENCHMARK_EMAIL = "benchmark@cashow.test";
const BENCHMARK_NAME = "Benchmark";
const TOTAL_TRANSACTIONS = 100_000;
const INCOME_COUNT = 15_000;
const TRANSFER_COUNT = 5_000;
const EXPENSE_COUNT = TOTAL_TRANSACTIONS - INCOME_COUNT - TRANSFER_COUNT;
const ALLOCATION_COUNT = 20_000;
const BATCH_SIZE = 5_000;
const DAYS = 1_095; // three years
const TIMEZONE = "Asia/Jakarta";

type TransactionRow = {
  id: string;
  userId: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  occurredAt: string;
  occurredOn: string;
  source: "MANUAL";
  createdAt: string;
  updatedAt: string;
};

/** Deterministic PRNG so re-seeding produces the same shape. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = mulberry32(20261027);

function between(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pick<T>(values: readonly T[]): T {
  const value = values[Math.floor(random() * values.length)];
  if (value === undefined) throw new Error("Cannot pick from an empty list.");
  return value;
}

async function insertTransactions(rows: TransactionRow[]): Promise<void> {
  if (rows.length === 0) return;

  const plan = db.raw.sql`
    INSERT INTO "public"."Transaction"
      ("id","userId","type","amount","accountId","destinationAccountId","categoryId",
       "occurredAt","occurredOn","source","createdAt","updatedAt")
    SELECT t.id, t."userId", t.type, t.amount, t."accountId", t."destinationAccountId",
           t."categoryId", t."occurredAt"::timestamptz, t."occurredOn"::date, t.source,
           t."createdAt"::timestamptz, t."updatedAt"::timestamptz
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(
      id text, "userId" text, type text, amount bigint, "accountId" text,
      "destinationAccountId" text, "categoryId" text,
      "occurredAt" text, "occurredOn" text, source text,
      "createdAt" text, "updatedAt" text
    )`
    .affectedCount()
    .build();

  await db.execute(plan);
}

async function insertAllocations(
  rows: {
    id: string;
    userId: string;
    expenseId: string;
    incomeId: string;
    amount: number;
    createdAt: string;
  }[],
): Promise<void> {
  if (rows.length === 0) return;

  const plan = db.raw.sql`
    INSERT INTO "public"."Allocation"
      ("id","userId","expenseId","incomeId","amount","createdAt")
    SELECT t.id, t."userId", t."expenseId", t."incomeId", t.amount,
           t."createdAt"::timestamptz
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS t(
      id text, "userId" text, "expenseId" text, "incomeId" text,
      amount bigint, "createdAt" text
    )`
    .affectedCount()
    .build();

  await db.execute(plan);
}

async function seed(): Promise<void> {
  const existing = await db.orm.public.User.where({ email: BENCHMARK_EMAIL }).first();

  // `SEED_CLEAN=1` removes the benchmark owner and stops. The first-run gate
  // closes as soon as any user exists, so a seeded local database cannot open
  // `/setup` again until this runs.
  if (process.env.SEED_CLEAN === "1") {
    if (existing === null) {
      console.log("no benchmark owner to remove");
      return;
    }
    await db.orm.public.User.where({ id: existing.id }).delete();
    console.log("removed the benchmark owner and its data");
    return;
  }

  if (existing !== null) {
    if (process.env.SEED_RESET !== "1") {
      throw new Error(
        `Benchmark owner already exists (${BENCHMARK_EMAIL}). Re-run with SEED_RESET=1 to rebuild, or SEED_CLEAN=1 to remove it.`,
      );
    }
    await db.orm.public.User.where({ id: existing.id }).delete();
    console.log("removed the previous benchmark owner");
  }

  const user = await db.orm.public.User.create({
    email: BENCHMARK_EMAIL,
    name: BENCHMARK_NAME,
    timezone: TIMEZONE,
  });

  const accountSpecs = [
    { name: "BCA", type: "BANK" as const, openingBalance: 8_500_000n, weight: 4 },
    { name: "GoPay", type: "EWALLET" as const, openingBalance: 450_000n, weight: 3 },
    { name: "Tunai", type: "CASH" as const, openingBalance: 300_000n, weight: 2 },
    { name: "Bibit", type: "INVESTMENT" as const, openingBalance: 12_000_000n, weight: 1 },
  ];

  const accounts = [];
  for (const spec of accountSpecs) {
    accounts.push({
      ...spec,
      id: (
        await db.orm.public.Account.create({
          userId: user.id,
          name: spec.name,
          type: spec.type,
          openingBalance: spec.openingBalance,
        })
      ).id,
    });
  }

  const weightedAccounts = accounts.flatMap((account) => Array(account.weight).fill(account));

  const expenseCategories = [];
  for (const name of ["Makan", "Transport", "Belanja", "Tagihan", "Hiburan", "Kesehatan"]) {
    expenseCategories.push(
      (
        await db.orm.public.Category.create({
          userId: user.id,
          name,
          kind: "EXPENSE",
        })
      ).id,
    );
  }

  const incomeCategories = [];
  for (const name of ["Gaji", "Freelance", "Bonus"]) {
    incomeCategories.push(
      (
        await db.orm.public.Category.create({
          userId: user.id,
          name,
          kind: "INCOME",
        })
      ).id,
    );
  }

  const now = new Date();
  const kinds: TransactionRow["type"][] = [
    ...Array<"INCOME">(INCOME_COUNT).fill("INCOME"),
    ...Array<"EXPENSE">(EXPENSE_COUNT).fill("EXPENSE"),
    ...Array<"TRANSFER">(TRANSFER_COUNT).fill("TRANSFER"),
  ];

  // Fisher-Yates with the deterministic PRNG keeps types interleaved in time.
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = kinds[i];
    const other = kinds[j];
    if (current === undefined || other === undefined) continue;
    kinds[i] = other;
    kinds[j] = current;
  }

  const startedAt = performance.now();
  let batch: TransactionRow[] = [];

  for (let index = 0; index < TOTAL_TRANSACTIONS; index += 1) {
    const type = kinds[index];
    if (type === undefined) continue;

    const occurredAt = new Date(
      now.getTime() - between(0, DAYS - 1) * 86_400_000 - between(0, 86_399) * 1_000,
    );

    const account = pick(weightedAccounts);
    let destinationAccountId: string | null = null;
    let categoryId: string | null = null;
    let amount: number;

    if (type === "INCOME") {
      amount = between(3_000_000, 15_000_000);
      categoryId = pick(incomeCategories);
    } else if (type === "EXPENSE") {
      amount = between(10_000, 750_000);
      categoryId = pick(expenseCategories);
    } else {
      amount = between(100_000, 2_000_000);
      const destination = pick(weightedAccounts.filter((candidate) => candidate.id !== account.id));
      destinationAccountId = destination.id;
    }

    const timestamp = occurredAt.toISOString();
    batch.push({
      id: uuidv7(),
      userId: user.id,
      type,
      amount,
      accountId: account.id,
      destinationAccountId,
      categoryId,
      occurredAt: timestamp,
      occurredOn: toLocalDate(occurredAt, TIMEZONE),
      source: "MANUAL",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (batch.length === BATCH_SIZE) {
      await insertTransactions(batch);
      batch = [];
    }
  }
  await insertTransactions(batch);

  // Allocate the oldest 20,000 expenses against income, round-robin. Incomes
  // are 4× larger than the biggest expense, so capacity is never exhausted.
  const expenses = await db.orm.public.Transaction.where({ userId: user.id, type: "EXPENSE" })
    .select("id", "amount")
    .orderBy((transaction) => transaction.occurredAt.asc())
    .limit(ALLOCATION_COUNT)
    .all();

  const incomes = await db.orm.public.Transaction.where({ userId: user.id, type: "INCOME" })
    .select("id", "amount")
    .orderBy((transaction) => transaction.occurredAt.asc())
    .all();

  const remaining = incomes.map((income) => Number(income.amount));
  let incomeIndex = 0;
  const allocations: {
    id: string;
    userId: string;
    expenseId: string;
    incomeId: string;
    amount: number;
    createdAt: string;
  }[] = [];
  let allocated = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    let income = incomes[incomeIndex];
    let capacity = remaining[incomeIndex];

    while (income === undefined || capacity === undefined || capacity < amount) {
      incomeIndex += 1;
      if (incomeIndex >= incomes.length) break;
      income = incomes[incomeIndex];
      capacity = remaining[incomeIndex];
    }

    if (income === undefined || capacity === undefined || incomeIndex >= incomes.length) break;

    remaining[incomeIndex] = capacity - amount;
    allocations.push({
      id: uuidv7(),
      userId: user.id,
      expenseId: expense.id,
      incomeId: income.id,
      amount,
      createdAt: new Date().toISOString(),
    });
    allocated += amount;

    if (allocations.length === BATCH_SIZE) {
      await insertAllocations(allocations);
      allocations.length = 0;
    }
  }
  await insertAllocations(allocations);

  const elapsedMs = Math.round(performance.now() - startedAt);
  const countPlan = db.raw.sql`
    SELECT type, count(*)::bigint AS count
    FROM "public"."Transaction"
    WHERE "userId" = ${user.id}
    GROUP BY type
    ORDER BY type`
    .returnsRow({ type: "pg/text@1", count: "pg/int8@1" })
    .build();
  const byType = Object.fromEntries(
    (await db.query(countPlan)).map((row) => [row.type, Number(row.count)]),
  );
  const allocationPlan = db.raw.sql`
    SELECT count(*)::bigint AS count
    FROM "public"."Allocation"
    WHERE "userId" = ${user.id}`
    .returnsRow({ count: "pg/int8@1" })
    .build();
  const allocationRows = await db.query(allocationPlan);

  console.log(
    JSON.stringify(
      {
        owner: { id: user.id, email: BENCHMARK_EMAIL },
        transactions: byType,
        allocations: {
          count: Number(allocationRows[0]?.count ?? 0n),
          allocated: `Rp${allocated.toLocaleString("id-ID")}`,
        },
        elapsedMs,
      },
      null,
      2,
    ),
  );
}

await seed();
await db.close();
