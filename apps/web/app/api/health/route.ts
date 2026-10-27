/**
 * Liveness probe — the process is up and serving requests.
 * Kept free of database access so Compose can distinguish a dead process
 * from a process that cannot reach Postgres (see `ready`).
 */
export async function GET() {
  return Response.json({ status: "ok" });
}
