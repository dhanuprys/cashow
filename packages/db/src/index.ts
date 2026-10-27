/**
 * Database access for Cashow.
 *
 * This package owns the schema, migrations, and the Prisma client. Everything
 * else in the monorepo reaches the database through this module — never
 * through a raw driver.
 *
 * The client (`db`) is constructed from the emitted contract and the
 * `DATABASE_URL` environment variable. Query surfaces:
 *   - `db.orm.public.<Model>`  — typed ORM (e.g. `db.orm.public.User`)
 *   - `db.sql.public.<table>`  — typed SQL builder
 *   - `db.query(plan)` / `db.execute(plan)` — run a built plan
 */

export type { Contract } from "./prisma/contract.d";
export { contract, db } from "./prisma/db";
