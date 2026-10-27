import { connection } from "next/server";

/**
 * Readiness probe — Postgres is reachable and the schema is queryable.
 *
 * The client is imported lazily so `next build` never needs a live database,
 * and `connection()` stops Cache Components from prerendering this handler at
 * build time.
 */
export async function GET() {
  await connection();

  try {
    // Imported inside the handler: `@cashow/db` validates DATABASE_URL when it
    // is first loaded, which must happen at request time, not build time.
    const { db } = await import("@cashow/db");
    await db.orm.public.User.select("id").all();
    return Response.json({ status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json({ status: "unavailable", error: message }, { status: 503 });
  }
}
