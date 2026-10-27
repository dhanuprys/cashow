/**
 * Phase 0 smoke test — round-trip a row through the typed client.
 *
 * Run:  bun scripts/smoke-db.ts
 *
 * Proves the contract, emitted types, runtime, and the `cashow` database all
 * line up (the "connect → write → read" arc from the Prisma 8 quickstart).
 *
 * The rows are removed afterwards: creating a user closes the first-run
 * `/setup` gate, and a smoke test must not change the app's state.
 */
import { db } from "@cashow/db";

const email = `smoke-${Date.now()}@cashow.test`;

const created = await db.orm.public.User.create({
  email,
  name: "Smoke Test",
  timezone: "Asia/Jakarta",
});

try {
  const found = await db.orm.public.User.where({ id: created.id }).all().firstOrThrow();

  // BigInt money round-trip: a whole-rupiah amount as a 64-bit integer.
  const account = await db.orm.public.Account.create({
    userId: found.id,
    name: "Bank Gopay",
    type: "EWALLET",
    openingBalance: 1_500_000n,
  });

  const readBack = await db.orm.public.Account.where({ id: account.id }).all().firstOrThrow();

  if (readBack.openingBalance !== 1_500_000n) {
    throw new Error(`openingBalance round-trip mismatch: ${readBack.openingBalance}`);
  }

  console.log(
    JSON.stringify(
      {
        level: "info",
        msg: "db smoke ok",
        user: found.email,
        account: readBack.name,
        openingBalance: String(readBack.openingBalance),
      },
      null,
      2,
    ),
  );
} finally {
  // Cascades remove the account and anything else this run created.
  await db.orm.public.User.where({ id: created.id }).delete();
  await db.close();
}
