/**
 * Phase 3 gate — summary, budgets and recurring templates.
 *
 * Run:  bun --env-file=.env scripts/test-summary.ts
 */
import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import {
  createBudget,
  createRecurring,
  createTransaction,
  ensureDefaultLedger,
  getBudgetStatus,
  getSummary,
  listAccounts,
  listCategories,
  runDueRecurring,
} from "@cashow/services";

const stamp = Date.now();
const userId = `summary-test-${stamp}`;
const ctx = { db, userId, now: new Date("2026-10-15T10:00:00+07:00") };

let checks = 0;
function pass(label: string): void {
  checks += 1;
  console.log(`  ok  ${label}`);
}
function equal<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

async function main(): Promise<void> {
  console.log("Creating throw-away owner…");
  await db.orm.public.User.create({
    id: userId,
    email: `summary-${stamp}@cashow.test`,
    name: "Summary Test",
    timezone: "Asia/Jakarta",
    budgetMonthStartDay: 25,
  });
  await db.transaction(async (tx) => {
    await ensureDefaultLedger(tx, userId);
  });

  const accounts = await listAccounts(ctx);
  assert.ok(accounts.ok, "listAccounts");
  const cash = accounts.value.find((a) => a.name === "Tunai");
  if (cash === undefined) throw new Error("default account missing");

  const categories = await listCategories(ctx);
  assert.ok(categories.ok, "listCategories");
  const incomeCategory = categories.value.find((c) => c.kind === "INCOME");
  const expenseCategory = categories.value.find((c) => c.kind === "EXPENSE");
  if (incomeCategory === undefined || expenseCategory === undefined)
    throw new Error("categories missing");

  await createTransaction(ctx, {
    type: "INCOME",
    amount: "1jt",
    accountId: cash.id,
    categoryId: incomeCategory.id,
    occurredAtLocal: "2026-10-10T09:00",
    source: "MANUAL",
    allocations: [],
  });
  await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "250rb",
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAtLocal: "2026-10-10T12:00",
    source: "MANUAL",
    allocations: [],
  });

  const summary = await getSummary(ctx, { period: "month" });
  assert.ok(summary.ok, "getSummary");
  equal(summary.value.income, 1_000_000n, "summary income");
  equal(summary.value.expense, 250_000n, "summary expense");
  equal(summary.value.net, 750_000n, "summary net");
  equal(summary.value.transactionCount, 2, "summary count");

  // Budget
  const budget = await createBudget(ctx, {
    name: "Belanja",
    categoryId: expenseCategory.id,
    amount: "300rb",
  });
  assert.ok(budget.ok, "createBudget");
  const status = await getBudgetStatus(ctx);
  assert.ok(status.ok, "getBudgetStatus");
  equal(status.value[0]?.spent, 250_000n, "budget spent");
  equal(status.value[0]?.remaining, 50_000n, "budget remaining");

  // Recurring: template due in the past creates a transaction.
  const template = await createRecurring(ctx, {
    type: "EXPENSE",
    amount: "10rb",
    accountId: cash.id,
    frequency: "DAILY",
    startDate: "2026-10-14",
  });
  assert.ok(template.ok, "createRecurring");
  const run = await runDueRecurring(ctx);
  assert.ok(run.ok, "runDueRecurring");
  equal(run.value >= 1, true, "recurring created at least one");

  // Cleanup
  await db.orm.public.RecurringTemplate.where({ userId }).deleteAll();
  await db.orm.public.Budget.where({ userId }).deleteAll();
  await db.orm.public.Transaction.where({ userId }).deleteAll();
  await db.orm.public.AuditLog.where({ userId }).deleteAll();
  await db.orm.public.Account.where({ userId }).deleteAll();
  await db.orm.public.Category.where({ userId }).deleteAll();
  await db.orm.public.User.where({ id: userId }).deleteAll();

  console.log(`\nPhase 3 summary gate: ${checks} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
