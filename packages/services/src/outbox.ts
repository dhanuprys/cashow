import { parseDbTimestamp } from "@cashow/domain";
import type { DbTransaction, UseCaseContext } from "./context";
import { snapshot } from "./json";

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

export interface OutboxEntry {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  status: string;
  attempts: number;
  createdAt: string;
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
