/**
 * Phase 2 gate — chains and balances, end to end.
 *
 * Run:  bun --env-file=.env scripts/test-chains.ts
 *
 * The script builds throw-away owners and proves:
 *   - a three-step plan with one partial payment derives the right status,
 *     totals and outstanding amount;
 *   - a transfer and its fee move the right balances and the fee is a real
 *     EXPENSE;
 *   - snapshots derive expected/gap on read, so a backdated snapshot recomputes
 *     later gaps;
 *   - a checkpoint freezes earlier transactions and snapshots, rejects a
 *     non-zero-gap snapshot, and unlocks deliberately with an audit entry.
 *
 * Direct table writes exercise PostgreSQL triggers, not the services, for the
 * invariant cases. Everything is removed afterwards.
 */
import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import {
  createAccount,
  createPlan,
  createSnapshot,
  createTransaction,
  createTransfer,
  ensureDefaultLedger,
  getPlan,
  getTransaction,
  listAccounts,
  listAuditLog,
  listOpenIncomes,
  listPlanItemOptions,
  listSnapshots,
  restoreTransaction,
  setPlanArchived,
  softDeleteSnapshot,
  softDeleteTransaction,
  unlockCheckpoint,
  updatePlanItem,
  verifyCheckpoint,
} from "@cashow/services";

const stamp = Date.now();
const userId = `chains-test-${stamp}`;
const otherUserId = `chains-other-${stamp}`;
const now = new Date("2026-10-27T03:00:00Z");
const ctx = { db, userId, now };

let checks = 0;

function pass(label: string): void {
  checks += 1;
  console.log(`  ok  ${label}`);
}

function equal<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

function ok<T>(result: { ok: true; value: T } | { ok: false; error: Error }, label: string): T {
  if (!result.ok) throw new Error(`${label}: ${result.error.message}`);
  pass(label);
  return result.value;
}

function failure(
  result: { ok: true; value: unknown } | { ok: false; error: Error },
  label: string,
): void {
  if (result.ok) throw new Error(`expected failure: ${label}`);
  pass(label);
}

async function rejectsDb(label: string, action: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`expected database rejection: ${label}`);
  pass(label);
}

async function main(): Promise<void> {
  console.log("Creating throw-away owners…");
  await db.orm.public.User.create({
    id: userId,
    email: `chains-${stamp}@cashow.test`,
    name: "Chains Test",
    timezone: "Asia/Jakarta",
  });
  await db.orm.public.User.create({
    id: otherUserId,
    email: `chains-other-${stamp}@cashow.test`,
    name: "Other Owner",
    timezone: "Asia/Jakarta",
  });
  await db.transaction(async (tx) => {
    await ensureDefaultLedger(tx, userId);
    await ensureDefaultLedger(tx, otherUserId);
  });

  const accounts = ok(await listAccounts(ctx), "listAccounts");
  const cash = accounts.find((account) => account.name === "Tunai");
  if (cash === undefined) throw new Error("default account missing");

  const bank = ok(
    await createAccount(ctx, {
      name: "Rekening Uji",
      type: "BANK",
      openingBalance: "0",
      currency: "IDR",
    }),
    "create reconciliation account",
  );
  const wallet = ok(
    await createAccount(ctx, {
      name: "Dompet Tujuan",
      type: "EWALLET",
      openingBalance: "0",
      currency: "IDR",
    }),
    "create transfer destination",
  );

  const categories = ok(await listOpenIncomes(ctx), "listOpenIncomes");
  equal(categories.length, 0, "no income exists yet");

  // -------------------------------------------------------------------------
  // Payment plan: three steps, one partial payment
  // -------------------------------------------------------------------------
  let plan = ok(
    await createPlan(ctx, {
      name: "Proyek Renovasi",
      description: "Dibayar tiga tahap",
      items: [
        { label: "DP", expectedAmount: "5jt", dueOn: "2026-11-01", note: null },
        { label: "Termin 2", expectedAmount: "5jt", dueOn: "2026-12-01", note: null },
        { label: "Pelunasan", expectedAmount: "5jt", dueOn: "2027-01-01", note: null },
      ],
    }),
    "create three-step plan",
  );
  equal(plan.items.length, 3, "plan has three items");
  equal(plan.expectedTotal, 15_000_000n, "plan expected total is Rp15.000.000");
  equal(plan.receivedTotal, 0n, "plan starts with nothing received");
  equal(plan.outstanding, 15_000_000n, "plan starts fully outstanding");
  equal(plan.status, "ACTIVE", "empty plan is active");

  const dpItem = plan.items[0];
  const secondItem = plan.items[1];
  const finalItem = plan.items[2];
  if (dpItem === undefined || secondItem === undefined || finalItem === undefined) {
    throw new Error("plan items missing");
  }

  const dpPayment = ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "5jt",
      accountId: cash.id,
      categoryId: null,
      planItemId: dpItem.id,
      note: "DP proyek",
      occurredAtLocal: "2026-10-01T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "link DP income to the first item",
  );
  equal(dpPayment.planItemId, dpItem.id, "income stores the plan item link");
  equal(dpPayment.planName, "Proyek Renovasi", "income reports its plan name");

  plan = ok(await getPlan(ctx, plan.id), "read plan after DP");
  equal(plan.items[0]?.status, "RECEIVED", "DP is received");
  equal(plan.items[1]?.status, "PENDING", "termin 2 is pending");
  equal(plan.receivedTotal, 5_000_000n, "plan received total is Rp5.000.000");
  equal(plan.outstanding, 10_000_000n, "plan outstanding is Rp10.000.000");

  ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "2,5jt",
      accountId: cash.id,
      categoryId: null,
      planItemId: secondItem.id,
      note: "Termin 2 sebagian",
      occurredAtLocal: "2026-10-15T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "link a partial second payment",
  );

  plan = ok(await getPlan(ctx, plan.id), "read plan after partial payment");
  equal(plan.items[1]?.receivedAmount, 2_500_000n, "termin 2 received Rp2.500.000");
  equal(plan.items[1]?.outstanding, 2_500_000n, "termin 2 still owes Rp2.500.000");
  equal(plan.items[1]?.status, "PARTIAL", "termin 2 is partial");
  equal(plan.receivedTotal, 7_500_000n, "plan received total is Rp7.500.000");
  equal(plan.outstanding, 7_500_000n, "plan outstanding is Rp7.500.000");
  equal(plan.progress, 50, "plan progress is 50 percent");
  equal(plan.status, "ACTIVE", "partly paid plan is active");

  ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "2,5jt",
      accountId: cash.id,
      categoryId: null,
      planItemId: secondItem.id,
      note: "Pelunasan termin 2",
      occurredAtLocal: "2026-10-20T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "settle termin 2",
  );
  ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "5,5jt",
      accountId: cash.id,
      categoryId: null,
      planItemId: finalItem.id,
      note: "Pelunasan lebih",
      occurredAtLocal: "2026-10-21T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "over-receive the final item",
  );

  plan = ok(await getPlan(ctx, plan.id), "read completed plan");
  equal(plan.items[1]?.status, "RECEIVED", "termin 2 is received");
  equal(plan.items[2]?.status, "OVER_RECEIVED", "extra payment is over-received");
  equal(plan.items[2]?.outstanding, 0n, "over-received item owes nothing");
  equal(plan.status, "COMPLETED", "plan is completed");

  const options = ok(await listPlanItemOptions(ctx), "plan picker excludes settled items");
  equal(options.length, 0, "no plan item still has an outstanding amount");

  // Overdue is derived from the due date, not stored.
  const overduePlan = ok(
    await createPlan(ctx, {
      name: "Sewa Terlambat",
      description: null,
      items: [{ label: "Sewa", expectedAmount: "3jt", dueOn: "2026-01-01", note: null }],
    }),
    "create overdue plan",
  );
  equal(overduePlan.items[0]?.status, "OVERDUE", "past-due unpaid item is overdue");
  equal(overduePlan.status, "OVERDUE", "plan rolls up overdue");

  // Archived plans refuse new payments but keep history.
  ok(await setPlanArchived(ctx, plan.id, true), "archive completed plan");
  failure(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "1jt",
      accountId: cash.id,
      categoryId: null,
      planItemId: finalItem.id,
      occurredAtLocal: "2026-10-22T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "an archived plan refuses a new linked income",
  );
  ok(await setPlanArchived(ctx, plan.id, false), "unarchive plan");

  // Updating an item changes derived totals without touching the income rows.
  ok(
    await updatePlanItem(ctx, finalItem.id, {
      label: "Pelunasan akhir",
      expectedAmount: "6jt",
      dueOn: "2027-01-01",
      note: "Dinaikkan",
    }),
    "update a plan item",
  );
  plan = ok(await getPlan(ctx, plan.id), "read plan after item edit");
  equal(plan.items[2]?.receivedAmount, 5_500_000n, "income survives the item edit");
  equal(plan.items[2]?.outstanding, 500_000n, "item now owes the difference");
  equal(plan.status, "ACTIVE", "plan reopens after its target rises");

  // -------------------------------------------------------------------------
  // Transfer with a fee
  // -------------------------------------------------------------------------
  ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "5jt",
      accountId: bank.id,
      categoryId: null,
      occurredAtLocal: "2026-10-01T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "fund the reconciliation account",
  );
  ok(
    await createTransaction(ctx, {
      type: "EXPENSE",
      amount: "1jt",
      accountId: bank.id,
      categoryId: null,
      occurredAtLocal: "2026-10-02T10:00",
      source: "MANUAL",
      allocations: [],
    }),
    "spend from the reconciliation account",
  );

  const transfer = ok(
    await createTransfer(ctx, {
      amount: "2jt",
      accountId: bank.id,
      destinationAccountId: wallet.id,
      feeAmount: "5rb",
      feeCategoryId: null,
      note: "Pindah dana",
      occurredAtLocal: "2026-10-03T11:00",
      source: "MANUAL",
    }),
    "create transfer with a fee",
  );
  equal(transfer.type, "TRANSFER", "created row is a transfer");
  equal(transfer.transferFeeAmount, 5_000n, "transfer reports its fee");
  equal(transfer.destinationAccountId, wallet.id, "transfer points at the destination");

  if (transfer.transferFeeId === null) throw new Error("transfer fee missing");
  const fee = ok(await getTransaction(ctx, transfer.transferFeeId), "read transfer fee");
  equal(fee.type, "EXPENSE", "the fee is its own expense");
  equal(fee.transferId, transfer.id, "the fee points back at the transfer");
  equal(fee.amount, 5_000n, "the fee amount is stored on the expense");
  equal(fee.categoryName, "Biaya Transfer", "the fee gets a real category");

  const afterTransfer = ok(await listAccounts(ctx), "balances after transfer");
  const bankAfter = afterTransfer.find((account) => account.id === bank.id);
  const walletAfter = afterTransfer.find((account) => account.id === wallet.id);
  equal(bankAfter?.balance, 1_995_000n, "source falls by amount plus fee");
  equal(walletAfter?.balance, 2_000_000n, "destination rises by the transfer amount");

  failure(
    await createTransfer(ctx, {
      amount: "1jt",
      accountId: bank.id,
      destinationAccountId: bank.id,
      feeAmount: "0",
      feeCategoryId: null,
      occurredAtLocal: "2026-10-03T12:00",
      source: "MANUAL",
    }),
    "a transfer to the same account is rejected",
  );

  // A transfer and its fee delete and restore as a pair.
  ok(await softDeleteTransaction(ctx, transfer.id), "soft delete the transfer");
  const feeDeleted = ok(await getTransaction(ctx, fee.id), "read fee after transfer delete");
  assert.notEqual(feeDeleted.deletedAt, null, "fee is deleted with its transfer");
  pass("fee is deleted with its transfer");
  ok(await restoreTransaction(ctx, transfer.id), "restore the transfer");
  const feeRestored = ok(await getTransaction(ctx, fee.id), "read fee after restore");
  equal(feeRestored.deletedAt, null, "fee is restored with its transfer");

  // The database also rejects a fee on the wrong account or owner.
  const bareTransfer = ok(
    await createTransfer(ctx, {
      amount: "100rb",
      accountId: bank.id,
      destinationAccountId: wallet.id,
      feeAmount: "0",
      feeCategoryId: null,
      occurredAtLocal: "2026-10-03T13:00",
      source: "MANUAL",
    }),
    "create a transfer without a fee",
  );
  await rejectsDb("a fee cannot use the destination account", async () => {
    await db.transaction(async (tx) => {
      await tx.orm.public.Transaction.create({
        userId,
        type: "EXPENSE",
        amount: 1_000n,
        accountId: wallet.id,
        transferId: bareTransfer.id,
        occurredAt: "2026-10-03T06:00:00.000Z",
        occurredOn: "2026-10-03",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Snapshots and reconciliation
  // -------------------------------------------------------------------------
  const snapshotA = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "1.895.000",
      recordedAtLocal: "2026-10-04T23:59",
      note: "Cek bank 4 Okt",
    }),
    "create a zero-gap snapshot",
  );
  equal(snapshotA.expectedAmount, 1_895_000n, "snapshot expected matches the ledger");
  equal(snapshotA.gap, 0n, "snapshot A has no gap");
  equal(snapshotA.gapKind, "BALANCED", "snapshot A is balanced");
  equal(
    snapshotA.transactionCount,
    5,
    "snapshot counts both transfers and the fee in its interval",
  );

  ok(
    await createTransaction(ctx, {
      type: "INCOME",
      amount: "1jt",
      accountId: bank.id,
      categoryId: null,
      occurredAtLocal: "2026-10-05T09:00",
      source: "MANUAL",
      allocations: [],
    }),
    "income after the first snapshot",
  );
  ok(
    await createTransaction(ctx, {
      type: "EXPENSE",
      amount: "500rb",
      accountId: bank.id,
      categoryId: null,
      occurredAtLocal: "2026-10-05T10:00",
      source: "MANUAL",
      allocations: [],
    }),
    "expense after the first snapshot",
  );

  const estimated = ok(await listAccounts(ctx), "estimated balance after snapshot");
  const bankEstimated = estimated.find((account) => account.id === bank.id);
  equal(bankEstimated?.balance, 2_395_000n, "estimated balance adds movements after the snapshot");
  equal(bankEstimated?.snapshotBalance, 1_895_000n, "estimated balance keeps the stated snapshot");
  equal(
    bankEstimated?.snapshotRecordedAt?.slice(0, 10),
    "2026-10-04",
    "snapshot age source is exposed",
  );

  const snapshotB = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "2.395.000",
      recordedAtLocal: "2026-10-06T23:59",
      note: "Cek bank 6 Okt",
    }),
    "create the next zero-gap snapshot",
  );
  equal(snapshotB.expectedAmount, 2_395_000n, "snapshot B expects the two later rows");
  equal(snapshotB.gap, 0n, "snapshot B starts balanced");

  // A backdated snapshot changes what B should have been. This is the gate.
  const backdated = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "1.500.000",
      recordedAtLocal: "2026-10-05T00:00",
      note: "Snapshot mundur",
    }),
    "create a backdated snapshot",
  );
  equal(backdated.expectedAmount, 1_895_000n, "backdated expected uses snapshot A");
  equal(backdated.gap, -395_000n, "backdated snapshot exposes its own gap");

  let timeline = ok(await listSnapshots(ctx, bank.id), "read snapshots after backdating");
  const recomputedB = timeline.find((snapshot) => snapshot.id === snapshotB.id);
  equal(
    recomputedB?.expectedAmount,
    2_000_000n,
    "later snapshot recomputes from the backdated one",
  );
  equal(recomputedB?.gap, 395_000n, "later snapshot gap changes on read, not on write");

  ok(await softDeleteSnapshot(ctx, backdated.id), "soft delete the backdated snapshot");
  timeline = ok(await listSnapshots(ctx, bank.id), "read snapshots after deleting backdate");
  const restoredB = timeline.find((snapshot) => snapshot.id === snapshotB.id);
  equal(restoredB?.gap, 0n, "deleting the backdate restores the later gap");

  const duplicate = await createSnapshot(ctx, {
    accountId: bank.id,
    amount: "2.395.000",
    recordedAtLocal: "2026-10-06T23:59",
    note: "Duplikat",
  });
  failure(duplicate, "a duplicate snapshot instant is rejected");

  // -------------------------------------------------------------------------
  // Checkpoints: zero-gap only, freeze, audited unlock
  // -------------------------------------------------------------------------
  const snapshotD = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "2.395.000",
      recordedAtLocal: "2026-10-07T23:59",
      note: "Siap diverifikasi",
    }),
    "create a checkpoint candidate",
  );

  const badSnapshot = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "9.999.999",
      recordedAtLocal: "2026-10-09T23:59",
      note: "Sengaja salah",
    }),
    "create a deliberately unbalanced snapshot",
  );
  failure(
    await verifyCheckpoint(ctx, badSnapshot.id),
    "a non-zero-gap snapshot cannot be verified",
  );
  await rejectsDb("the database also rejects a non-zero-gap checkpoint", async () => {
    await db.orm.public.ReconciliationCheckpoint.create({
      userId,
      accountId: bank.id,
      snapshotId: badSnapshot.id,
      snapshotAt: badSnapshot.recordedAt,
    });
  });

  const checkpoint = ok(await verifyCheckpoint(ctx, snapshotD.id), "verify a zero-gap checkpoint");
  equal(checkpoint.active, true, "the new checkpoint is active");
  equal(checkpoint.snapshotId, snapshotD.id, "checkpoint points at its snapshot");

  const lockedExpense = await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "10rb",
    accountId: bank.id,
    categoryId: null,
    occurredAtLocal: "2026-10-07T12:00",
    source: "MANUAL",
    allocations: [],
  });
  failure(lockedExpense, "a backdated write inside the checkpoint is rejected");

  const lockedUpdate = await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "1rb",
    accountId: bank.id,
    categoryId: null,
    occurredAtLocal: "2026-10-07T12:01",
    source: "MANUAL",
    allocations: [],
  });
  failure(lockedUpdate, "a second backdated write is rejected");
  const lockedSnapshot = await createSnapshot(ctx, {
    accountId: bank.id,
    amount: "2.000.000",
    recordedAtLocal: "2026-10-07T12:00",
    note: "Di dalam periode terkunci",
  });
  failure(lockedSnapshot, "a backdated snapshot inside the checkpoint is rejected");

  const lockedIncome = await listSnapshots(ctx, bank.id);
  const earlier = ok(lockedIncome, "read timeline before edit attempt")[1];
  if (earlier === undefined) throw new Error("earlier snapshot missing");
  const lockedDelete = await softDeleteSnapshot(ctx, earlier.id);
  failure(lockedDelete, "an earlier snapshot cannot be deleted while checkpointed");

  failure(
    await verifyCheckpoint(ctx, snapshotB.id),
    "an older snapshot cannot be verified behind an active checkpoint",
  );

  const auditBeforeUnlock = await listAuditLog(ctx, {
    entityType: "ReconciliationCheckpoint",
    entityId: checkpoint.id,
    limit: 10,
  });
  assert.ok(
    auditBeforeUnlock.some((entry) => entry.action === "VERIFY"),
    "verification writes an audit entry",
  );
  pass("verification writes an audit entry");

  const unlocked = ok(
    await unlockCheckpoint(ctx, checkpoint.id, { reason: "Koreksi tanggal transfer" }),
    "unlock a checkpoint",
  );
  equal(unlocked.active, false, "unlocked checkpoint is inactive");
  equal(unlocked.unlockReason, "Koreksi tanggal transfer", "unlock reason is stored");

  const auditAfterUnlock = await listAuditLog(ctx, {
    entityType: "ReconciliationCheckpoint",
    entityId: checkpoint.id,
    limit: 10,
  });
  assert.ok(
    auditAfterUnlock.some((entry) => entry.action === "UNLOCK"),
    "unlock writes an audit entry",
  );
  pass("unlock writes an audit entry");

  const allowedExpense = ok(
    await createTransaction(ctx, {
      type: "EXPENSE",
      amount: "100rb",
      accountId: bank.id,
      categoryId: null,
      occurredAtLocal: "2026-10-07T12:00",
      source: "MANUAL",
      allocations: [],
    }),
    "the same write succeeds after unlock",
  );
  assert.equal(allowedExpense.occurredOn, "2026-10-07");
  pass("the unlocked write keeps its local book date");

  // A settled period can be checked again with a fresh zero-gap snapshot.
  const snapshotE = ok(
    await createSnapshot(ctx, {
      accountId: bank.id,
      amount: "2.395.000",
      recordedAtLocal: "2026-10-08T23:59",
      note: "Setelah koreksi",
    }),
    "create a new zero-gap snapshot after the correction",
  );
  equal(snapshotE.expectedAmount, 2_395_000n, "new snapshot includes the corrected expense");
  const checkpoint2 = ok(await verifyCheckpoint(ctx, snapshotE.id), "verify the new period");
  equal(checkpoint2.active, true, "new checkpoint is active");

  // -------------------------------------------------------------------------
  // Database-level ownership guards
  // -------------------------------------------------------------------------
  const otherAccounts = await listAccounts({ db, userId: otherUserId, now });
  const otherCash = ok(otherAccounts, "other owner's accounts")[0];
  if (otherCash === undefined) throw new Error("other owner account missing");
  await rejectsDb("an income cannot link another owner's plan item", async () => {
    await db.transaction(async (tx) => {
      await tx.orm.public.Transaction.create({
        userId: otherUserId,
        type: "INCOME",
        amount: 1_000n,
        accountId: otherCash.id,
        planItemId: finalItem.id,
        occurredAt: "2026-10-10T02:00:00.000Z",
        occurredOn: "2026-10-10",
      });
    });
  });

  assert.ok(plan.id.length > 0, "plan exists");
  pass("phase 2 chain gate complete");
}

async function cleanup(): Promise<void> {
  for (const id of [userId, otherUserId]) {
    await db.transaction(async (tx) => {
      await tx.orm.public.ReconciliationCheckpoint.where({ userId: id }).deleteAll();
      await tx.orm.public.BalanceSnapshot.where({ userId: id }).deleteAll();
      await tx.orm.public.Transaction.where({ userId: id }).deleteAll();
      await tx.orm.public.PaymentPlan.where({ userId: id }).deleteAll();
      await tx.orm.public.Attachment.where({ userId: id }).deleteAll();
      await tx.orm.public.Category.where({ userId: id }).deleteAll();
      await tx.orm.public.Account.where({ userId: id }).deleteAll();
      await tx.orm.public.OutboxEvent.where({ userId: id }).deleteAll();
      await tx.orm.public.AuditLog.where({ userId: id }).deleteAll();
      await tx.orm.public.User.where({ id }).deleteAll();
    });
  }
}

try {
  await main();
  console.log(`\n${checks} checks passed.`);
} finally {
  console.log("Cleaning up…");
  await cleanup();
  await db.close();
}
