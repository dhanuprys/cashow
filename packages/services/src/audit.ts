import { parseDbTimestamp } from "@cashow/domain";
import type { QueryClient, UseCaseContext } from "./context";
import { snapshot } from "./json";

/**
 * Every ledger write records an audit row in the same transaction (plan §6,
 * "It writes an audit entry and appears in the export"). Actor is the owner;
 * `null` is reserved for the worker/system.
 */
export async function writeAudit(
  tx: QueryClient,
  entry: {
    userId: string;
    entityType: string;
    entityId: string;
    action:
      | "CREATE"
      | "UPDATE"
      | "SOFT_DELETE"
      | "RESTORE"
      | "ARCHIVE"
      | "UNARCHIVE"
      | "MERGE"
      | "VERIFY"
      | "UNLOCK";
    before?: object | null;
    after?: object | null;
    actorId?: string | null;
  },
): Promise<void> {
  await tx.orm.public.AuditLog.create({
    userId: entry.userId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    before: entry.before === undefined || entry.before === null ? null : snapshot(entry.before),
    after: entry.after === undefined || entry.after === null ? null : snapshot(entry.after),
    actorId: entry.actorId === undefined ? entry.userId : entry.actorId,
  });
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  createdAt: string;
}

/** Newest audit rows for the owner; `entityId` narrows to one record. */
export async function listAuditLog(
  ctx: UseCaseContext,
  options: { entityType?: string; entityId?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  let query = ctx.db.orm.public.AuditLog.where((row) => row.userId.eq(ctx.userId));
  if (options.entityType !== undefined) {
    query = query.where((row) => row.entityType.eq(options.entityType as string));
  }
  if (options.entityId !== undefined) {
    query = query.where((row) => row.entityId.eq(options.entityId as string));
  }

  const rows = await query
    .orderBy((row) => row.createdAt.desc())
    .limit(limit)
    .all();
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    actorId: row.actorId,
    createdAt: parseDbTimestamp(row.createdAt).toISOString(),
  }));
}
