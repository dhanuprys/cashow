import { ensureDefaultLedger } from "@cashow/services";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { z } from "zod";
import { loadPendingChallenge, readRegistrationPayload } from "@/lib/auth/challenges";
import { getAuthConfig } from "@/lib/auth/config";
import {
  assertSameOrigin,
  badRequest,
  clientAddress,
  conflict,
  errorDetail,
  json,
  unauthorized,
} from "@/lib/auth/http";
import { describeDevice, encodeBytes } from "@/lib/auth/passkeys";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  getSessionUser,
  hashToken,
  newSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/setup";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  challengeId: z.string().min(1).max(128),
  response: z.unknown(),
  deviceName: z.string().trim().max(60).optional(),
});

class ChallengeAlreadyUsedError extends Error {}
class SetupClosedError extends Error {}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const limit = checkRateLimit(`register-verify:${clientAddress(request)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Permintaan pendaftaran tidak valid.");

  const challenge = await loadPendingChallenge(parsed.data.challengeId, "REGISTRATION");
  if (challenge === null) {
    return badRequest("Sesi pendaftaran sudah kedaluwarsa. Mulai ulang pendaftaran.");
  }

  const payload = readRegistrationPayload(challenge.payload);
  if (payload === null || challenge.subjectId === null) {
    return badRequest("Sesi pendaftaran tidak lengkap. Mulai ulang pendaftaran.");
  }

  if (payload.kind === "setup") {
    if (await hasAnyUser()) {
      return conflict("Setup pemilik sudah selesai. Silakan masuk dengan passkey.");
    }
  } else {
    const sessionUser = await getSessionUser();
    if (sessionUser === null || sessionUser.id !== challenge.subjectId) {
      return unauthorized();
    }
  }

  const config = getAuthConfig();

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
    });
  } catch (error) {
    return badRequest("Passkey tidak dapat diverifikasi.", errorDetail(error));
  }

  if (!verification.verified) {
    return badRequest("Passkey tidak dapat diverifikasi.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const userId = challenge.subjectId;
  const deviceName =
    parsed.data.deviceName?.trim() ||
    describeDevice(request.headers.get("user-agent"), credentialDeviceType);

  const db = await getDb();

  let token: string;
  try {
    token = newSessionToken();

    await db.transaction(async (tx) => {
      // Single-use: the conditional update is the gate, in the same
      // transaction as the writes it authorizes.
      const consumed = await tx.orm.public.AuthChallenge.where({ id: challenge.id })
        .where((row) => row.consumedAt.isNull())
        .update({ consumedAt: new Date().toISOString() });

      if (consumed === null) throw new ChallengeAlreadyUsedError();

      if (payload.kind === "setup") {
        const users = await tx.orm.public.User.select("id").limit(1).all();
        if (users.length > 0) throw new SetupClosedError();

        await tx.orm.public.User.create({
          id: userId,
          name: payload.name,
          email: payload.email,
        });

        // First run seeds the account and categories the ledger UI needs, in
        // the same transaction that creates the owner.
        await ensureDefaultLedger(tx, userId);
      }

      await tx.orm.public.Passkey.create({
        userId,
        credentialId: credential.id,
        publicKey: encodeBytes(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports === undefined ? null : credential.transports.join(","),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: deviceName,
      });

      await tx.orm.public.Session.create({
        userId,
        tokenHash: hashToken(token),
        expiresAt: sessionExpiry(),
        ipAddress: clientAddress(request),
        userAgent: request.headers.get("user-agent"),
      });
    });
  } catch (error) {
    if (error instanceof ChallengeAlreadyUsedError) {
      return badRequest("Sesi pendaftaran sudah dipakai. Mulai ulang pendaftaran.");
    }
    if (error instanceof SetupClosedError) {
      return conflict("Setup pemilik sudah selesai. Silakan masuk dengan passkey.");
    }
    console.error("register/verify failed", error);
    return badRequest("Pendaftaran passkey gagal.", errorDetail(error));
  }

  await setSessionCookie(token);
  return json({ ok: true });
}
