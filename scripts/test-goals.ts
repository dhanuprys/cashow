/**
 * Verification gate — savings goals, account reservations and safe-to-spend.
 *
 * Run:  bun --env-file=.env scripts/test-goals.ts
 */
import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import {
  addGoalReservation,
  archiveGoal,
  createGoal,
  ensureDefaultLedger,
  getGoalReservationTotals,
  getSafeToSpend,
  listAccounts,
  listGoals,
  removeGoalReservation,
} from "@cashow/services";

const stamp = Date.now();
const userId = `goals-test-${stamp}`;
const ctx = { db, userId, now: new Date("2026-11-04T10:00:00+07:00") };

let checks = 0;
function pass(label: string): void {
  checks += 1;
  console.log(`  ok  ${label}`);
}

async function main(): Promise<void> {
  console.log("Creating throw-away owner for goals test…");
  await db.orm.public.User.create({
    id: userId,
    email: `goals-${stamp}@cashow.test`,
    name: "Goals Test",
    timezone: "Asia/Jakarta",
    budgetMonthStartDay: 1,
  });

  try {
    await db.transaction(async (tx) => {
      await ensureDefaultLedger(tx, userId);
      await tx.orm.public.Account.create({
        userId,
        name: "Bank BCA",
        type: "BANK",
        openingBalance: 10_000_000n,
      });
    });

    const accountsBefore = await listAccounts(ctx);
    assert.ok(accountsBefore.ok);
    const bank = accountsBefore.value.find((a) => a.type === "BANK");
    if (!bank) throw new Error("Bank account missing");
    const initialBalance = bank.balance;

    // 1. Create a goal
    const goalRes = await createGoal(ctx, {
      name: "Dana Darurat",
      description: "Cadangan 6 bulan",
      targetAmount: "12000000",
      targetDate: "2027-02-01",
    });
    assert.ok(goalRes.ok, "createGoal succeeded");
    const goalId = goalRes.value.id;
    pass("Goal created with target and deadline");

    // 2. Reserve funds on the bank account
    const reserveRes = await addGoalReservation(ctx, {
      goalId,
      accountId: bank.id,
      amount: "2000000",
      note: "Setoran awal",
    });
    assert.ok(reserveRes.ok, "addGoalReservation succeeded");
    const reservationId = reserveRes.value.id;
    pass("Reserved 2.000.000 on bank account");

    // CRITICAL: Real bank account balance MUST NOT change!
    const accountsAfter = await listAccounts(ctx);
    assert.ok(accountsAfter.ok);
    const bankAfter = accountsAfter.value.find((a) => a.id === bank.id);
    assert.equal(
      bankAfter?.balance,
      initialBalance,
      "Real bank balance remains untouched after reservation",
    );
    pass("Real bank balance remains 100% faithful to bank statements");

    // 3. Goal totals & pacing
    const goalsList = await listGoals(ctx);
    assert.ok(goalsList.ok);
    const goal = goalsList.value.find((g) => g.id === goalId);
    assert.equal(goal?.savedAmount, 2_000_000n, "Goal savedAmount is 2.000.000");
    assert.equal(goal?.remainingAmount, 10_000_000n, "Goal remainingAmount is 10.000.000");
    assert.ok((goal?.monthlyPacing ?? 0n) > 0n, "Monthly pacing calculated");
    pass("Goal progress and pacing computed accurately");

    // 4. Over-reservation guard
    const overReserve = await addGoalReservation(ctx, {
      goalId,
      accountId: bank.id,
      amount: "9999999999",
      note: "Too much",
    });
    assert.equal(overReserve.ok, false, "Over-reservation rejected");
    pass("Over-reservation guard prevents committing phantom funds");

    // 5. Safe to spend deducts active reservation
    const sts = await getSafeToSpend(ctx);
    assert.ok(sts.ok);
    assert.equal(sts.value.reserved, 2_000_000n, "Safe to spend reflects reserved goal funds");
    pass("Safe to spend correctly protects reserved savings funds");

    // 6. Removing single reservation restores free cash
    const deleteRes = await removeGoalReservation(ctx, reservationId);
    assert.ok(deleteRes.ok, "removeGoalReservation succeeded");
    const totalsAfterDelete = await getGoalReservationTotals(ctx);
    assert.ok(totalsAfterDelete.ok);
    assert.equal(totalsAfterDelete.value.total, 0n, "Totals 0 after deleting reservation");
    pass("Removing reservation restores free balance");

    // Re-add reservation before testing goal archive
    await addGoalReservation(ctx, {
      goalId,
      accountId: bank.id,
      amount: "1500000",
    });

    // 7. Archiving goal automatically releases all reservations
    const archiveRes = await archiveGoal(ctx, goalId);
    assert.ok(archiveRes.ok, "archiveGoal succeeded");
    const liveGoals = await listGoals(ctx);
    assert.ok(liveGoals.ok);
    assert.equal(liveGoals.value.length, 0, "Archived goal excluded from active list");

    const totalsAfterArchive = await getGoalReservationTotals(ctx);
    assert.ok(totalsAfterArchive.ok);
    assert.equal(
      totalsAfterArchive.value.total,
      0n,
      "Archiving goal cleanly released reservations",
    );
    pass("Closing/archiving goal releases all reserved money back to free cash");

    console.log(`\nAll ${checks} goal and reservation checks passed.\n`);
  } finally {
    await db.orm.public.User.where({ id: userId }).delete();
    await db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
