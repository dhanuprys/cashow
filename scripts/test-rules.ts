import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import { evaluateRule } from "@cashow/domain";
import {
  createRule,
  createTransaction,
  ensureDefaultLedger,
  listAccounts,
  listCategories,
  runRules,
} from "@cashow/services";

const stamp = Date.now();
const userId = `rules-test-${stamp}`;
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
  await db.orm.public.User.create({
    id: userId,
    email: `rules-${stamp}@cashow.test`,
    name: "Rules Test",
    timezone: "Asia/Jakarta",
  });
  await db.transaction(async (tx) => {
    await ensureDefaultLedger(tx, userId);
  });

  const accounts = await listAccounts(ctx);
  assert.ok(accounts.ok, "listAccounts");
  const cash = accounts.value.find((a: { name: string }) => a.name === "Tunai")!;
  const categories = await listCategories(ctx);
  assert.ok(categories.ok, "listCategories");
  const expenseCategory = categories.value.find((c: { kind: string }) => c.kind === "EXPENSE")!;

  await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "200rb",
    accountId: cash.id,
    categoryId: expenseCategory.id,
    occurredAtLocal: "2026-10-15T09:00",
    source: "MANUAL",
    allocations: [],
  });

  const rule = await createRule(ctx, {
    name: "Daily spend",
    trigger: { type: "transaction" },
    condition: { metric: "expenseToday", op: "gt", value: 100000 },
    actions: [],
    settings: { severity: "INFO", cooldownMinutes: 0, edgeTriggered: true },
    active: true,
  });
  assert.ok(rule.ok, "createRule");

  // Pure evaluator check
  equal(
    evaluateRule({ metric: "expenseToday", op: "gt", value: 100000 }, { expenseToday: 200000 }),
    true,
    "evaluator fires",
  );

  const fired = await runRules(ctx, "transaction");
  assert.ok(fired.ok, "runRules");
  equal(fired.value >= 1, true, "rule fired");

  // Edge-triggered: second run should not fire again.
  const fired2 = await runRules(ctx, "transaction");
  assert.ok(fired2.ok, "runRules2");
  equal(fired2.value, 0, "edge-triggered no duplicate");

  // Cleanup
  await db.orm.public.RuleFiring.where({ userId }).deleteAll();
  await db.orm.public.RuleState.where({ userId }).deleteAll();
  await db.orm.public.Rule.where({ userId }).deleteAll();
  await db.orm.public.Notification.where({ userId }).deleteAll();
  await db.orm.public.Transaction.where({ userId }).deleteAll();
  await db.orm.public.Account.where({ userId }).deleteAll();
  await db.orm.public.Category.where({ userId }).deleteAll();
  await db.orm.public.User.where({ id: userId }).deleteAll();

  console.log(`\nPhase 5 rules gate: ${checks} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
