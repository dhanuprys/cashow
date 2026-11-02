import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import { loadPendingChallenge } from "@/lib/auth/challenges";
import { getAuthConfig } from "@/lib/auth/config";
import {
  assertSameOrigin,
  badRequest,
  clientAddress,
  errorDetail,
  json,
  unauthorized,
} from "@/lib/auth/http";
import { toWebAuthnCredential } from "@/lib/auth/passkeys";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { hashToken, newSessionToken, sessionExpiry, setSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  challengeId: z.string().min(1).max(128),
  response: z.unknown(),
});

class ChallengeAlreadyUsedError extends Error {}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const limit = checkRateLimit(`login-verify:${clientAddress(request)}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan masuk. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Permintaan masuk tidak valid.");

  const challenge = await loadPendingChallenge(parsed.data.challengeId, "AUTHENTICATION");
  if (challenge === null) {
    return badRequest("Sesi masuk sudah kedaluwarsa. Coba lagi.");
  }

  const response = parsed.data.response as AuthenticationResponseJSON;
  if (typeof response?.id !== "string") return badRequest("Passkey tidak dapat diverifikasi.");

  const db = await getDb();
  const passkey = await db.orm.public.Passkey.where({ credentialId: response.id }).first();

  if (passkey === null || passkey.revokedAt !== null) {
    return unauthorized("Passkey tidak dikenali atau sudah dicabut.");
  }

  const config = getAuthConfig(request);

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origins,
      expectedRPID: config.rpID,
      credential: toWebAuthnCredential(passkey),
    });
  } catch (error) {
    return badRequest("Passkey tidak dapat diverifikasi.", errorDetail(error));
  }

  if (!verification.verified) {
    return unauthorized("Passkey tidak dapat diverifikasi.");
  }

  const token = newSessionToken();
  const now = new Date().toISOString();

  try {
    await db.transaction(async (tx) => {
      const consumed = await tx.orm.public.AuthChallenge.where({ id: challenge.id })
        .where((row) => row.consumedAt.isNull())
        .update({ consumedAt: now });

      if (consumed === null) throw new ChallengeAlreadyUsedError();

      // Counter regression is detected by simplewebauthn; persist the new
      // value so the next assertion is checked against it.
      await tx.orm.public.Passkey.where({ id: passkey.id }).update({
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: now,
        backedUp: verification.authenticationInfo.credentialBackedUp,
      });

      await tx.orm.public.Session.create({
        userId: passkey.userId,
        tokenHash: hashToken(token),
        expiresAt: sessionExpiry(),
        ipAddress: clientAddress(request),
        userAgent: request.headers.get("user-agent"),
      });
    });
  } catch (error) {
    if (error instanceof ChallengeAlreadyUsedError) {
      return badRequest("Sesi masuk sudah dipakai. Coba lagi.");
    }
    console.error("login/verify failed", error);
    return badRequest("Masuk gagal.", errorDetail(error));
  }

  await setSessionCookie(token);
  return json({ ok: true });
}
