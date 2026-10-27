import { assertSameOrigin, conflict, json, unauthorized } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/**
 * Revoke one passkey. The last remaining passkey is protected: revoking it
 * would lock the only owner out of a passwordless account.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const user = await getSessionUser();
  if (user === null) return unauthorized();

  const { id } = await context.params;
  const db = await getDb();

  const passkeys = await db.orm.public.Passkey.where({ userId: user.id })
    .select("id", "revokedAt")
    .all();
  const active = passkeys.filter((passkey) => passkey.revokedAt === null);

  if (!active.some((passkey) => passkey.id === id)) {
    return json({ error: "Passkey tidak ditemukan." }, { status: 404 });
  }

  if (active.length <= 1) {
    return conflict("Tidak bisa mencabut passkey terakhir. Tambahkan passkey lain dulu.");
  }

  await db.orm.public.Passkey.where({ id, userId: user.id }).update({
    revokedAt: new Date().toISOString(),
  });

  return json({ ok: true });
}
