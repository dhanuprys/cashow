import type * as CashowDb from "@cashow/db";

/**
 * The database client and the active transaction share the same query
 * surface. Services take a context instead of importing `@cashow/db` at module
 * scope, so a build (or a unit test) never needs `DATABASE_URL` to load them.
 */
export type Database = (typeof CashowDb)["db"];
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type QueryClient = Database | DbTransaction;

export interface UseCaseContext {
  db: Database;
  /** Every query is scoped to this owner; the schema is multi-user ready. */
  userId: string;
  /** Injectable clock for tests; defaults to the wall clock. */
  now?: Date;
}

export function nowOf(ctx: UseCaseContext): Date {
  return ctx.now ?? new Date();
}
