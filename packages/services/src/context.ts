import type * as CashowDb from "@cashow/db";

/**
 * The database client and the active transaction share the same query
 * surface. Services take a context instead of importing `@cashow/db` at module
 * scope, so a build (or a unit test) never needs `DATABASE_URL` to load them.
 */
export type Database = (typeof CashowDb)["db"];
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryClient = Database | DbTransaction;

/**
 * Reads the backup artefacts' status files (`last-run.json`, `last-drill.json`)
 * without the service layer touching `node:fs` — the same port pattern as
 * `AttachmentStorage`. Returns the parsed `at` stamp (`YYYYMMDDTHHMMSSZ`) or
 * `null` when the file is missing, unreadable or malformed.
 */
export interface BackupStatusReader {
  lastRunAt(): Promise<string | null>;
  lastDrillAt(): Promise<string | null>;
}

export interface UseCaseContext {
  db: Database;
  /** Every query is scoped to this owner; the schema is multi-user ready. */
  userId: string;
  /** Injectable clock for tests; defaults to the wall clock. */
  now?: Date;
  /** Optional backup freshness source; absent means "never ran". */
  backups?: BackupStatusReader;
}

export function nowOf(ctx: UseCaseContext): Date {
  return ctx.now ?? new Date();
}

/** The owner's timezone; every stored local date derives from it. */
export async function userTimezone(client: QueryClient, userId: string): Promise<string> {
  const user = await client.orm.public.User.where({ id: userId }).select("timezone").first();
  return user?.timezone ?? "Asia/Jakarta";
}
