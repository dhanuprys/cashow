import { loadEnv } from "@cashow/config";
import { db } from "@cashow/db";
import { runDueRecurring, runRules } from "@cashow/services";

const env = loadEnv();

const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown.abort());
}

console.log(
  JSON.stringify({ level: "info", msg: "cashow worker starting", nodeEnv: env.NODE_ENV }),
);

async function tick(): Promise<void> {
  // Process pending outbox events.
  const events = await db.orm.public.OutboxEvent.where({ status: "PENDING" })
    .orderBy((row) => row.createdAt.asc())
    .limit(50)
    .all();

  for (const event of events) {
    try {
      const ctx = { db, userId: event.userId };
      await runRules(ctx, event.eventType);
      await db.orm.public.OutboxEvent.where({ id: event.id }).update({
        status: "PROCESSED",
        publishedAt: new Date().toISOString(),
      });
    } catch (error) {
      await db.orm.public.OutboxEvent.where({ id: event.id }).update({
        status: "FAILED",
        attempts: (event.attempts ?? 0) + 1,
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Run due recurring templates for all users.
  const users = await db.orm.public.User.all();
  for (const user of users) {
    try {
      const ctx = { db, userId: user.id };
      await runDueRecurring(ctx);
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
