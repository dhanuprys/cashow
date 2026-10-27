import { parseDbTimestamp } from "@cashow/domain";
import type { Database, DbTransaction, UseCaseContext } from "./context";
import { LedgerError } from "./errors";
import { snapshot } from "./json";
import { err, ok, type Result } from "./result";

const MAX_ATTEMPTS = 5;

/**
 * Transactional outbox (plan §5/§6): an event row is written in the same
 * transaction as the ledger change, so no committed change exists without its
 * event. Consumers (Phase 5 rules, notifications) claim rows later.
 */
export async function writeOutbox(
  tx: DbTransaction,
  event: {
    userId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: object;
  },
): Promise<void> {
  await tx.orm.public.OutboxEvent.create({
    userId: event.userId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    eventType: event.eventType,
    payload: snapshot(event.payload),
  });
}

export interface ClaimedOutboxEvent {
  id: string;
  userId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  attempts: number;
}

export interface OutboxEntry {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  status: string;
  attempts: number;
  createdAt: string;
}

/**
 * Claim a batch of due outbox events for one worker.
 *
 * Runs inside a transaction and uses `FOR UPDATE SKIP LOCKED`, so two worker
 * processes never claim the same row. Claimed rows flip to `PROCESSING`
 * (committed with the claim) and are re-queued by `failOutboxEvent`.
 *
 * Due means: PENDING (or a stale PROCESSING row older than its backoff), under
 * the attempt cap, and older than the exponential backoff for its attempt count.
 */
export async function claimOutboxEvents(
  db: Database,
  limit = 25,
): Promise<Result<ClaimedOutboxEvent[]>> {
  const batch = Math.min(Math.max(limit, 1), 100);
  try {
    const claimed = await db.transaction(async (tx) => {
      const plan = tx.raw.sql`
        SELECT e."id" AS id,
               e."userId" AS "userId",
               e."aggregateType" AS "aggregateType",
               e."aggregateId" AS "aggregateId",
               e."eventType" AS "eventType",
               e."attempts"::int AS attempts
        FROM "public"."OutboxEvent" e
        WHERE e."status" IN ('PENDING', 'PROCESSING')
          AND e."attempts" < ${MAX_ATTEMPTS}
          AND e."createdAt" <= now() - (${10_000} * power(2, e."attempts")) * interval '1 millisecond'
        ORDER BY e."createdAt" ASC
        LIMIT ${batch}::int
        FOR UPDATE SKIP LOCKED
      `
        .returnsRow({
          id: "pg/text@1",
          userId: "pg/text@1",
          aggregateType: "pg/text@1",
          aggregateId: "pg/text@1",
          eventType: "pg/text@1",
          attempts: "pg/int4@1",
        })
        .build();

      const rows = await tx.query(plan);
      if (rows.length === 0) return rows;

      const idsJson = JSON.stringify(rows.map((row) => row.id));
      const updatePlan = tx.raw.sql`
        UPDATE "public"."OutboxEvent" e
        SET "status" = 'PROCESSING'
        WHERE e."id" IN (SELECT value FROM jsonb_array_elements_text(${idsJson}::jsonb))
      `
        .affectedCount()
        .build();
      await tx.execute(updatePlan);

      return rows;
    });

    return ok(claimed);
  } catch (error) {
    return err(
      error instanceof LedgerError
        ? error
        : new LedgerError("INTERNAL", "Gagal mengambil event outbox."),
    );
  }
}

/** Mark a claimed event handled. */
export async function markOutboxProcessed(db: Database, id: string): Promise<void> {
  await db.orm.public.OutboxEvent.where({ id }).update({
    status: "PROCESSED",
    publishedAt: new Date().toISOString(),
  });
}

/**
 * Re-queue a claimed event after a handler error, incrementing attempts and
 * dead-lettering at the cap so a poison event cannot spin forever.
 */
export async function failOutboxEvent(
  db: Database,
  id: string,
  previousAttempts: number,
  error: unknown,
): Promise<void> {
  const attempts = previousAttempts + 1;
  await db.orm.public.OutboxEvent.where({ id }).update({
    status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
    attempts,
    lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
  });
}

/** Newest outbox rows, for the settings/debug view and the ledger gate. */
export async function listOutboxEvents(
  ctx: UseCaseContext,
  options: { limit?: number } = {},
): Promise<OutboxEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = await ctx.db.orm.public.OutboxEvent.where({ userId: ctx.userId })
    .orderBy((row) => row.createdAt.desc())
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    status: row.status,
    attempts: row.attempts,
    createdAt: parseDbTimestamp(row.createdAt).toISOString(),
  }));
}
