/**
 * The worker process (section 6): outbox consumer, rule evaluation, delivery
 * and schedules. Runs as a second long-lived process from the same codebase.
 *
 * Phase 0 keeps the process alive with a graceful shutdown hook so the Compose
 * topology (start, health, restart policy) is exercised. The job loop lands
 * with the outbox consumer in Phase 1.
 */
import { loadEnv } from "@cashow/config";

const env = loadEnv();

const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => shutdown.abort());
}

console.log(
  JSON.stringify({
    level: "info",
    msg: "cashow worker starting",
    nodeEnv: env.NODE_ENV,
  }),
);

await new Promise<void>((resolve) => {
  if (shutdown.signal.aborted) {
    resolve();
    return;
  }
  shutdown.signal.addEventListener("abort", () => resolve(), { once: true });
});

console.log(JSON.stringify({ level: "info", msg: "cashow worker stopped" }));
