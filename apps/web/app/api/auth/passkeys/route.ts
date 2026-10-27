import { json, unauthorized } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

/** The signed-in owner's passkeys, safe for display (no key material). */
export async function GET() {
  const user = await getSessionUser();
  if (user === null) return unauthorized();

  const db = await getDb();
  const passkeys = await db.orm.public.Passkey.where({ userId: user.id })
    .select("id", "name", "deviceType", "backedUp", "createdAt", "lastUsedAt", "revokedAt")
    .all();

  return json({
    passkeys: passkeys
      .filter((passkey) => passkey.revokedAt === null)
      .map((passkey) => ({
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
      })),
  });
}
