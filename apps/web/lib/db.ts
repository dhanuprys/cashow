import type * as CashowDb from "@cashow/db";

type Db = (typeof CashowDb)["db"];

let dbPromise: Promise<Db> | undefined;

/**
 * Resolve the database client at request time. Importing `@cashow/db` at
 * module scope validates `DATABASE_URL`, which must not happen during
 * `next build`; every auth module goes through this helper instead.
 */
export function getDb(): Promise<Db> {
  dbPromise ??= import("@cashow/db").then((module) => module.db);
  return dbPromise;
}
