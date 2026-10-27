import { loadEnv } from "@cashow/config";
import { db } from "@cashow/db";
import { SCHEDULED_TRIGGERS, triggerFamilyOf } from "@cashow/domain";
import {
  claimOutboxEvents,
  deliverPendingNotifications,
  failOutboxEvent,
  markOutboxProcessed,
  runDueRecurring,
  runRules,
} from "@cashow/services";
import { createFileBackupStatusReader } from "./backup-status";
import { createPushSender } from "./push";

const env = loadEnv();

/** Backup freshness source shared by every rule evaluation in this process. */
const backups = createFileBackupStatusReader(env.BACKUP_DIR);

const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown.abort());
}

console.log(
  JSON.stringify({ level: "info", msg: "cashow worker starting", nodeEnv: env.NODE_ENV }),
);

async function processOutbox(): Promise<void> {
  // Claim a batch under `FOR UPDATE SKIP LOCKED` so two workers never handle
  // the same event; each claimed row is flipped to PROCESSING before handling.
  const claimed = await claimOutboxEvents(db, 25);
  if (!claimed.ok) {
    console.error(
      JSON.stringify({ level: "error", msg: "outbox claim failed", error: claimed.error.message }),
    );
    return;
  }

  for (const event of claimed.value) {
    try {
      const ctx = { db, userId: event.userId };
      const fired = await runRules(ctx, triggerFamilyOf(event.eventType));
      if (!fired.ok) throw fired.error;
      await markOutboxProcessed(db, event.id);
    } catch (error) {
      await failOutboxEvent(db, event.id, event.attempts, error);
      console.error(
        JSON.stringify({
          level: "error",
          msg: "outbox event failed",
          eventId: event.id,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

async function runScheduledRules(): Promise<void> {
  const users = await db.orm.public.User.all();
  for (const user of users) {
    try {
      const result = await runRules({ db, userId: user.id, backups }, [...SCHEDULED_TRIGGERS]);
      if (!result.ok) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "scheduled rules failed",
            userId: user.id,
            error: result.error.message,
          }),
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "scheduled rules failed",
          userId: user.id,
          error: String(error),
        }),
      );
    }
  }
}

async function runRecurring(): Promise<void> {
  // Draft generation is capped per tick inside the service, so a long-dormant
  // template cannot block the worker.
  const users = await db.orm.public.User.all();
  for (const user of users) {
    try {
      const result = await runDueRecurring({ db, userId: user.id });
      if (!result.ok) throw result.error;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "recurring run failed",
          userId: user.id,
          error: String(error),
        }),
      );
    }
  }
}

const pushSender = createPushSender(env);

async function deliverNotifications(): Promise<void> {
  try {
    const result = await deliverPendingNotifications(db, pushSender);
    if (!result.ok) throw result.error;
    if (result.value.sent > 0 || result.value.failed > 0) {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "push delivery",
          sent: result.value.sent,
          failed: result.value.failed,
          pruned: result.value.pruned,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", msg: "push delivery failed", error: String(error) }),
    );
  }
}

let tickCount = 0;

async function tick(): Promise<void> {
  await processOutbox();
  await deliverNotifications();
  // Recurring and scheduled rules are wall-clock work: run them every tick
  // (5s), which is cheap for a single-owner instance.
  await runRecurring();
  await runScheduledRules();
  tickCount += 1;
  if (tickCount % 120 === 0) {
    console.log(JSON.stringify({ level: "info", msg: "worker heartbeat", ticks: tickCount }));
  }
}

while (!shutdown.signal.aborted) {
  try {
    await tick();
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", msg: "worker tick failed", error: String(error) }),
    );
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5000);
    shutdown.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

console.log(JSON.stringify({ level: "info", msg: "cashow worker stopped" }));
