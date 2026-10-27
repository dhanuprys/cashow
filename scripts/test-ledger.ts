/**
 * Phase 1 gate — the core ledger, end to end, plus every invalid allocation
 * the database must reject.
 *
 * Run:  bun --env-file=.env scripts/test-ledger.ts
 *
 * The script builds a throw-away owner, exercises the service layer, then
 * fires directly at the tables so PostgreSQL (not the service) is the thing
 * under test for the invariant cases. Everything is removed afterwards.
 */
import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import {
  createTransaction,
  ensureDefaultLedger,
  getMonthOverview,
  getTransaction,
  listAccounts,
  listAuditLog,
  listCategories,
  listOpenIncomes,
  listOutboxEvents,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from "@cashow/services";

const stamp = Date.now();
const userId = `ledger-test-${stamp}`;
const otherUserId = `ledger-other-${stamp}`;
const ctx = { db, userId, now: new Date() };

let checks = 0;
function pass(label: string): void {
  checks += 1;
  console.log(`  ok  ${label}`);
}

function equal<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

async function rejects(label: string, action: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`expected rejection: ${label}`);
  checks += 1;
  console.log(`  ok  ${label}`);
}

async function main(): Promise<void> {
  console.log("Creating throw-away owner…");
  await db.orm.public.User.create({
    id: userId,
    email: `ledger-${stamp}@cashow.test`,
    name: "Ledger Test",
  });
  await db.orm.public.User.create({
    id: otherUserId,
    email: `ledger-other-${stamp}@cashow.test`,
    name: "Other Owner",
  });
  await db.transaction(async (tx) => {
    await ensureDefaultLedger(tx, userId);
    await ensureDefaultLedger(tx, otherUserId);
  });

  const accounts = await listAccounts(ctx);
  assert.ok(accounts.ok, "listAccounts");
  const cash = accounts.value.find((account) => account.name === "Tunai");
  if (cash === undefined) throw new Error("default account missing");

  const categories = await listCategories(ctx);
  assert.ok(categories.ok, "listCategories");
  const incomeCategory = categories.value.find((category) => category.kind === "INCOME");
  const expenseCategory = categories.value.find((category) => category.kind === "EXPENSE");
  if (incomeCategory === undefined || expenseCategory === undefined) {
    throw new Error("default categories missing");
  }
  pass("first-run defaults: Tunai account and categories");

  // --- The plan's example: Rp500.000 income, Rp250.000 expense -------------
  const income = await createTransaction(ctx, {
    type: "INCOME",
    amount: "Rp 500.000",
    accountId: cash.id,
    categoryId: incomeCategory.id,
    note: "Gaji contoh",
    occurredAtLocal: "2026-10-05T09:00",
    clientRequestId: `income-${stamp}`,
  });
  if (!income.ok) throw income.error;
  equal(income.value.amount, 500_000n, "income stores Rp500.000 as bigint");

  const expense = await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "250rb",
    accountId: cash.id,
    categoryId: expenseCategory.id,
    note: "Belanja contoh",
    occurredAtLocal: "2026-10-06T12:30",
    allocations: [{ incomeId: income.value.id, amount: "250.000" }],
  });
  if (!expense.ok) throw expense.error;
  equal(expense.value.allocated, 250_000n, "expense records a Rp250.000 allocation");
  equal(expense.value.allocationCount, 1, "expense has one allocation");
  equal(expense.value.allocations[0]?.incomeId, income.value.id, "allocation points at the income");

  const detail = await getTransaction(ctx, expense.value.id);
  if (!detail.ok) throw detail.error;
  equal(detail.value.occurredOn, "2026-10-06", "occurredOn derives from WIB local date");

  const open = await listOpenIncomes(ctx);
  if (!open.ok) throw open.error;
  const incomeOpen = open.value.find((row) => row.id === income.value.id);
  if (incomeOpen === undefined) throw new Error("income should still have free money");
  equal(incomeOpen.free, 250_000n, "income keeps Rp250.000 free");

  const afterExpense = await listAccounts(ctx);
  if (!afterExpense.ok) throw afterExpense.error;
  equal(
    afterExpense.value.find((account) => account.id === cash.id)?.balance,
    250_000n,
    "account balance derives as income minus expense",
  );

  const auditRows = await listAuditLog(ctx);
  const outboxRows = await listOutboxEvents(ctx);
  assert.ok(
    auditRows.some((row) => row.entityType === "Transaction"),
    "audit row missing",
  );
  assert.ok(
    outboxRows.some((row) => row.eventType === "transaction.created"),
    "outbox event missing",
  );
  pass("audit and outbox rows committed with the ledger writes");

  // --- Idempotent create ---------------------------------------------------
  const retry = await createTransaction(ctx, {
    type: "INCOME",
    amount: "Rp 500.000",
    accountId: cash.id,
    categoryId: incomeCategory.id,
    note: "Gaji contoh",
    occurredAtLocal: "2026-10-05T09:00",
    clientRequestId: `income-${stamp}`,
  });
  if (!retry.ok) throw retry.error;
  equal(retry.value.id, income.value.id, "same clientRequestId returns the first transaction");

  // --- Monthly summary -----------------------------------------------------
  const overview = await getMonthOverview(ctx, "2026-10");
  if (!overview.ok) throw overview.error;
  equal(overview.value.income, 500_000n, "overview income");
  equal(overview.value.expense, 250_000n, "overview expense");
  equal(overview.value.net, 250_000n, "overview net");

  // --- Edit replaces allocations ------------------------------------------
  const otherIncome = await createTransaction(ctx, {
    type: "INCOME",
    amount: "300000",
    accountId: cash.id,
    categoryId: incomeCategory.id,
    occurredAtLocal: "2026-10-07T08:00",
  });
  if (!otherIncome.ok) throw otherIncome.error;

  const edited = await updateTransaction(ctx, expense.value.id, {
    amount: "200000",
    allocations: [{ incomeId: otherIncome.value.id, amount: "200000" }],
    note: "Belanja dikoreksi",
  });
  if (!edited.ok) throw edited.error;
  equal(edited.value.amount, 200_000n, "expense amount updated");
  equal(edited.value.allocations[0]?.incomeId, otherIncome.value.id, "allocations replaced");

  const openAfterEdit = await listOpenIncomes(ctx);
  if (!openAfterEdit.ok) throw openAfterEdit.error;
  equal(
    openAfterEdit.value.find((row) => row.id === income.value.id)?.free,
    500_000n,
    "previous income is free again after reallocation",
  );

  // --- Service rejects over-allocation before the database is hit ---------
  const serviceOverAllocation = await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "100000",
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAtLocal: "2026-10-08T08:00",
    allocations: [{ incomeId: income.value.id, amount: "600000" }],
  });
  equal(serviceOverAllocation.ok, false, "service rejects drawing more than the income holds");

  // --- Database invariants ------------------------------------------------
  const overAllocatedExpense = await createRawTransaction(ctx, {
    type: "EXPENSE",
    amount: 100_000n,
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAt: "2026-10-09T02:00:00.000Z",
    occurredOn: "2026-10-09",
  });
  await rejects("database rejects an allocation above the income's free amount", () =>
    createRawAllocation(userId, overAllocatedExpense.id, income.value.id, 600_000n),
  );

  await rejects("database rejects an allocation above the expense's amount", () =>
    createRawAllocation(userId, overAllocatedExpense.id, otherIncome.value.id, 150_000n),
  );

  const rawIncome = await createRawTransaction(ctx, {
    type: "INCOME",
    amount: 1_000_000n,
    accountId: cash.id,
    categoryId: incomeCategory.id,
    occurredAt: "2026-10-10T02:00:00.000Z",
    occurredOn: "2026-10-10",
  });
  await rejects("database rejects an allocation that swaps income and expense", () =>
    createRawAllocation(userId, rawIncome.id, overAllocatedExpense.id, 10_000n),
  );

  await rejects("database rejects an allocation with amount zero", () =>
    createRawAllocation(userId, overAllocatedExpense.id, income.value.id, 0n),
  );

  const otherCash = await listAccounts({ db, userId: otherUserId });
  if (!otherCash.ok) throw otherCash.error;
  const otherAccount = otherCash.value[0];
  if (otherAccount === undefined) throw new Error("other owner account missing");
  const otherIncomeRaw = await createRawTransaction(
    { db, userId: otherUserId },
    {
      type: "INCOME",
      amount: 300_000n,
      accountId: otherAccount.id,
      occurredAt: "2026-10-11T02:00:00.000Z",
      occurredOn: "2026-10-11",
    },
  );
  await rejects("database rejects an allocation that crosses owners", () =>
    createRawAllocation(userId, overAllocatedExpense.id, otherIncomeRaw.id, 50_000n),
  );

  await rejects("database rejects an expense using an income category", () =>
    createRawTransaction(ctx, {
      type: "EXPENSE",
      amount: 10_000n,
      accountId: cash.id,
      categoryId: incomeCategory.id,
      occurredAt: "2026-10-12T02:00:00.000Z",
      occurredOn: "2026-10-12",
    }),
  );

  await rejects("database rejects a zero amount", () =>
    createRawTransaction(ctx, {
      type: "EXPENSE",
      amount: 0n,
      accountId: cash.id,
      occurredAt: "2026-10-12T02:00:00.000Z",
      occurredOn: "2026-10-12",
    }),
  );

  // A soft-deleted transaction's allocations are void, so it cannot be a
  // source or a target while deleted.
  const deletedExpense = await createRawTransaction(ctx, {
    type: "EXPENSE",
    amount: 50_000n,
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAt: "2026-10-13T02:00:00.000Z",
    occurredOn: "2026-10-13",
    deletedAt: "2026-10-13T03:00:00.000Z",
  });
  await rejects("database rejects an allocation to a soft-deleted expense", () =>
    createRawAllocation(userId, deletedExpense.id, income.value.id, 10_000n),
  );

  // Restore re-checks the sum: shrink a deleted expense below its allocations.
  const restoreCase = await createRawTransaction(ctx, {
    type: "EXPENSE",
    amount: 90_000n,
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAt: "2026-10-14T02:00:00.000Z",
    occurredOn: "2026-10-14",
  });
  await createRawAllocation(userId, restoreCase.id, income.value.id, 80_000n);
  const deleted = await softDeleteTransaction(ctx, restoreCase.id);
  if (!deleted.ok) throw deleted.error;
  await db.orm.public.Transaction.where({ id: restoreCase.id, userId }).update({
    amount: 10_000n,
  });
  const restore = await restoreTransaction(ctx, restoreCase.id);
  equal(restore.ok, false, "restore is refused when allocations no longer fit");

  console.log(`\nPhase 1 ledger gate: ${checks} checks passed.`);
}

async function createRawTransaction(
  context: { db: typeof db; userId: string },
  input: {
    type: "INCOME" | "EXPENSE";
    amount: bigint;
    accountId: string;
    categoryId?: string;
    occurredAt: string;
    occurredOn: string;
    deletedAt?: string;
  },
) {
  return context.db.orm.public.Transaction.create({
    userId: context.userId,
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    categoryId: input.categoryId ?? null,
    occurredAt: input.occurredAt,
    occurredOn: input.occurredOn,
    deletedAt: input.deletedAt ?? null,
  });
}

async function createRawAllocation(
  userId: string,
  expenseId: string,
  incomeId: string,
  amount: bigint,
): Promise<void> {
  await db.orm.public.Allocation.create({ userId, expenseId, incomeId, amount });
}

try {
  await main();
} catch (error) {
  console.error("Phase 1 ledger gate FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.orm.public.User.where({ id: userId }).delete();
  await db.orm.public.User.where({ id: otherUserId }).delete();
  await db.close();
}
