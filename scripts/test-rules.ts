import { strict as assert } from "node:assert";
import { db } from "@cashow/db";
import { evaluateRule, parseBackupStamp, parseDbTimestamp } from "@cashow/domain";
import {
  claimOutboxEvents,
  createRule,
  createTransaction,
  deliverPendingNotifications,
  ensureDefaultLedger,
  listAccounts,
  listCategories,
  listNotifications,
  markNotificationRead,
  markOutboxProcessed,
  type PushSender,
  runRules,
  savePushSubscription,
  snoozeNotification,
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
  const defaultAccount = accounts.value[0];
  assert.ok(defaultAccount, "default account exists");

  const categories = await listCategories(ctx);
  assert.ok(categories.ok, "listCategories");
  const expenseCategory = categories.value.find((c) => c.kind === "EXPENSE");
  assert.ok(expenseCategory, "expense category exists");

  await createTransaction(ctx, {
    type: "EXPENSE",
    amount: "10000",
    accountId: defaultAccount.id,
    categoryId: expenseCategory.id,
    merchant: null,
    counterparty: null,
    note: null,
    occurredAtLocal: "2026-10-15T09:00",
    source: "MANUAL",
    allocations: [],
    clientRequestId: null,
  });

  await createRule(ctx, {
    name: "Spending over 5rb today",
    description: null,
    trigger: { type: "transaction" },
    condition: {
      metric: "expenseToday",
      op: "gt",
      value: 5000,
    },
    actions: [],
    settings: { severity: "WARNING" },
    active: true,
  });

  const evaluation = evaluateRule(
    { metric: "expenseToday", op: "gt", value: 5000 },
    { expenseToday: 10000 },
  );
  assert.equal(evaluation, true);
  pass("evaluator fires");

  // --- End to end: outbox claim → rule → notification → push delivery --------

  // 1. The ledger write left a `transaction.created` event behind.
  // Purge every outbox row left by earlier gate runs so the claim batch is
  // deterministic: other test users otherwise accumulate rows faster than
  // this one and crowd ours out of the `LIMIT`.
  const stale = await db.orm.public.OutboxEvent.where({}).all();
  for (const row of stale) {
    if (row.userId !== userId) {
      await db.orm.public.OutboxEvent.where({ id: row.id }).deleteAll();
    }
  }

  // A previous aborted run can leave PENDING delivery rows behind, and
  // `deliverPendingNotifications` claims every due row in the database, not
  // just this user's. Purge foreign ones so the batch is deterministic.
  const staleDeliveries = await db.orm.public.NotificationDelivery.where({
    status: "PENDING",
  }).all();
  for (const row of staleDeliveries) {
    const owner = await db.orm.public.Notification.where({ id: row.notificationId })
      .select("userId")
      .first();
    if (owner !== null && owner.userId !== userId) {
      await db.orm.public.NotificationDelivery.where({ id: row.id }).deleteAll();
    }
  }

  const outbox = await db.orm.public.OutboxEvent.where({ userId }).all();
  const event = outbox.find((row) => row.eventType === "transaction.created");
  assert.ok(event, "transaction.created outbox event exists");
  pass("outbox event written with the ledger change");

  // 2. A push endpoint exists for the owner, so a notification fans out.
  const saved = await savePushSubscription(ctx, {
    endpoint: "https://push.example.test/one",
    p256dh: "p256dh-one",
    auth: "auth-one",
    label: "gate",
  });
  assert.ok(saved.ok, "savePushSubscription");

  // 3. Claim the event exactly as the worker does, and run its rule family.
  // A fresh event is inside the 10s attempt-0 backoff, so backdate it to make
  // it due — the worker in production just waits for the next tick.
  await db.transaction(async (tx) => {
    const plan = tx.raw.sql`
      UPDATE "public"."OutboxEvent"
      SET "createdAt" = now() - interval '1 minute'
      WHERE "id" = ${event.id}
    `
      .affectedCount()
      .build();
    await tx.execute(plan);
  });

  const claimed = await claimOutboxEvents(db, 25);
  assert.ok(claimed.ok, "claimOutboxEvents");
  const mine = claimed.value.find((row) => row.id === event.id);
  assert.ok(mine, "claimed the transaction event");
  equal(mine.attempts, 0, "claim reports attempt count");

  const processed = await db.orm.public.OutboxEvent.where({ id: event.id }).first();
  equal(processed?.status, "PROCESSING", "claim flips the row to PROCESSING");

  const fired = await runRules(ctx, "transaction");
  assert.ok(fired.ok, "runRules");
  equal(fired.value, 1, "rule fired from the claimed event");

  await markOutboxProcessed(db, event.id);
  const done = await db.orm.public.OutboxEvent.where({ id: event.id }).first();
  equal(done?.status, "PROCESSED", "event marked PROCESSED");

  // 4. The notification exists and one delivery row was fanned out per endpoint.
  const notifications = await listNotifications(ctx, { limit: 10 });
  assert.ok(notifications.ok, "listNotifications");
  equal(notifications.value.length, 1, "one notification created");
  const notification = notifications.value[0];
  assert.ok(notification, "notification exists");

  const deliveries = await db.orm.public.NotificationDelivery.where({
    notificationId: notification.id,
  }).all();
  equal(deliveries.length, 1, "one delivery per active push endpoint");
  equal(deliveries[0]?.status, "PENDING", "delivery starts PENDING");

  // 5. A fake sender records the payload, as the worker's web-push sender would.
  const sent: { title: string; body: string }[] = [];
  const sender: PushSender = async (_subscription, payload) => {
    sent.push({ title: payload.title, body: payload.body });
    return { ok: true };
  };
  const delivery = await deliverPendingNotifications(db, sender);
  assert.ok(delivery.ok, "deliverPendingNotifications");
  equal(delivery.value.sent, 1, "one push sent");
  equal(sent.length, 1, "sender received exactly one payload");
  equal(sent[0]?.title, notification.title, "payload carries the notification title");

  const sentRow = await db.orm.public.NotificationDelivery.where({
    notificationId: notification.id,
  }).first();
  equal(sentRow?.status, "SENT", "delivery recorded SENT");
  assert.ok(sentRow?.deliveredAt !== null, "deliveredAt recorded");
  pass("delivery records deliveredAt");

  // 6. A second fan-out for a gone endpoint (HTTP 410) prunes it.
  const savedTwo = await savePushSubscription(ctx, {
    endpoint: "https://push.example.test/gone",
    p256dh: "p256dh-two",
    auth: "auth-two",
    label: "gate-410",
  });
  assert.ok(savedTwo.ok, "savePushSubscription second endpoint");

  const goneSender: PushSender = async (subscription) =>
    subscription.endpoint.endsWith("/gone") ? { ok: false, gone: true } : { ok: true };

  // A fresh notification triggers a new fan-out to both active endpoints.
  const second = await db.orm.public.Notification.create({
    userId,
    title: "Uji prune",
    body: "Endpoint hilang",
    severity: "INFO",
    url: null,
    dedupeKey: null,
  });
  const endpoints = await db.orm.public.ChannelEndpoint.where({
    userId,
    kind: "PUSH",
    active: true,
  }).all();
  for (const endpoint of endpoints) {
    await db.orm.public.NotificationDelivery.create({
      notificationId: second.id,
      channelEndpointId: endpoint.id,
      channel: "PUSH",
      status: "PENDING",
    });
  }

  const pruned = await deliverPendingNotifications(db, goneSender);
  assert.ok(pruned.ok, "deliverPendingNotifications prune run");
  equal(pruned.value.pruned, 1, "one endpoint pruned on 410");

  const goneEndpoint = await db.orm.public.ChannelEndpoint.where({
    endpoint: "https://push.example.test/gone",
  }).first();
  equal(goneEndpoint?.active, false, "gone endpoint deactivated");

  // 7. Read and snooze keep working on the delivered notification.
  const read = await markNotificationRead(ctx, notification.id);
  assert.ok(read.ok, "markNotificationRead");
  const readRow = await db.orm.public.Notification.where({ id: notification.id }).first();
  assert.ok(readRow?.readAt !== null, "readAt recorded");
  pass("notification marked read");

  const snoozed = await snoozeNotification(ctx, notification.id, 60);
  assert.ok(snoozed.ok, "snoozeNotification");
  const snoozedRow = await db.orm.public.Notification.where({ id: notification.id }).first();
  assert.ok(snoozedRow, "snoozed notification exists");
  assert.ok(snoozedRow.snoozedUntil !== null, "snoozedUntil recorded");
  const deltaMinutes = snoozedRow.snoozedUntil
    ? (parseDbTimestamp(snoozedRow.snoozedUntil).getTime() - ctx.now.getTime()) / 60_000
    : 0;
  equal(Math.round(deltaMinutes), 60, "snooze is one hour from ctx.now");

  // 8. Re-running the rule with the same state is edge-triggered: the
  // condition is still true, but no second notification may be produced.
  const duplicate = await runRules(ctx, "transaction");
  assert.ok(duplicate.ok, "runRules");
  equal(duplicate.value, 0, "edge-triggered no duplicate");

  // --- Backup freshness ----------------------------------------------------

  equal(
    parseBackupStamp("20261015T030000Z")?.toISOString(),
    "2026-10-15T03:00:00.000Z",
    "stamp parses",
  );
  equal(parseBackupStamp("nope"), null, "malformed stamp returns null");

  // The seeded system rules are the only backup-triggered rules for this user.
  const systemRules = await db.orm.public.Rule.where({ userId }).all();
  const backupRules = systemRules.filter(
    (rule) => (rule.trigger as { type?: string }).type === "backup",
  );
  equal(backupRules.length, 2, "two system backup rules seeded");

  // ctx.now is 2026-10-15T03:00:00Z. A 30-minute-old backup is fresh; a
  // drill 41 days old is stale. Only the drill rule may fire.
  const freshBackups = {
    lastRunAt: async () => "20261015T023000Z",
    lastDrillAt: async () => "20260904T030000Z",
  };
  const freshCtx = { ...ctx, backups: freshBackups };
  const staleDrill = await runRules(freshCtx, "backup");
  assert.ok(staleDrill.ok, "runRules backup");
  equal(staleDrill.value, 1, "stale drill fires once");

  const repeat = await runRules(freshCtx, "backup");
  assert.ok(repeat.ok, "runRules backup repeat");
  equal(repeat.value, 0, "fresh backup + unchanged stale drill stays edge-triggered");

  // A backup that goes stale while the drill is still fresh fires only the
  // backup rule; the drill rule's state is already true and stays quiet.
  const staleBackup = {
    lastRunAt: async () => "20261013T030000Z",
    lastDrillAt: async () => "20260904T030000Z",
  };
  const staleBackupCtx = { ...ctx, backups: staleBackup };
  const staleRun = await runRules(staleBackupCtx, "backup");
  assert.ok(staleRun.ok, "runRules backup stale");
  equal(staleRun.value, 1, "stale backup fires once");

  // A reader that reports nothing (job never ran) is the worst case, but both
  // rules already fired above and edge-triggering keeps them quiet.
  const neverRan = {
    lastRunAt: async () => null,
    lastDrillAt: async () => null,
  };
  const neverRanCtx = { ...ctx, backups: neverRan };
  const missing = await runRules(neverRanCtx, "backup");
  assert.ok(missing.ok, "runRules backup missing files");
  equal(missing.value, 0, "missing files with both rules already true stays quiet");

  // A caller with no reader at all behaves like "never ran".
  const noReader = await runRules(ctx, "backup");
  assert.ok(noReader.ok, "runRules backup without reader");
  equal(noReader.value, 0, "no reader stays edge-triggered");

  await db.orm.public.User.where({ id: userId }).deleteAll();

  console.log(`\nPhase 5 rules gate: ${checks} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
