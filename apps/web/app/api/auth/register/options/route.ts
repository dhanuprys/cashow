import { uuidv7 } from "@cashow/domain";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { z } from "zod";
import { createChallenge, type RegistrationPayload } from "@/lib/auth/challenges";
import { getAuthConfig } from "@/lib/auth/config";
import {
  assertSameOrigin,
  badRequest,
  clientAddress,
  forbidden,
  json,
  unauthorized,
} from "@/lib/auth/http";
import { parseTransports } from "@/lib/auth/passkeys";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { hasAnyUser, setupTokenMatches } from "@/lib/auth/setup";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().max(200).optional(),
  setupToken: z.string().max(256).optional(),
});

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const limit = checkRateLimit(`register-options:${clientAddress(request)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Data pendaftaran tidak valid.");

  const config = getAuthConfig();
  const setupRequired = !(await hasAnyUser());
  const sessionUser = setupRequired ? null : await getSessionUser();
  const db = await getDb();

  let subjectId: string;
  let payload: RegistrationPayload;
  let userName: string;
  let userDisplayName: string;

  if (setupRequired) {
    if (!setupTokenMatches(parsed.data.setupToken)) {
      return forbidden("Token setup tidak valid.");
    }

    const name = parsed.data.name?.trim() ?? "";
    if (name === "") return badRequest("Nama wajib diisi.");

    const email = parsed.data.email?.trim() ?? "";
    if (email !== "" && !z.string().email().safeParse(email).success) {
      return badRequest("Alamat email tidak valid.");
    }

    subjectId = uuidv7();
    payload = { kind: "setup", name, email: email === "" ? null : email };
    userName = email === "" ? name : email;
    userDisplayName = name;
  } else {
    if (sessionUser === null) return unauthorized();

    subjectId = sessionUser.id;
    payload = { kind: "add" };
    userName = sessionUser.email ?? sessionUser.name ?? "owner";
    userDisplayName = sessionUser.name ?? userName;
  }

  const existing = await db.orm.public.Passkey.where({ userId: subjectId })
    .select("credentialId", "transports", "revokedAt")
    .all();

  const excludeCredentials = existing
    .filter((passkey) => passkey.revokedAt === null)
    .map((passkey) => ({
      id: passkey.credentialId,
      transports: parseTransports(passkey.transports),
    }));

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: new TextEncoder().encode(subjectId),
    userName,
    userDisplayName,
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  const challengeId = await createChallenge({
    purpose: "REGISTRATION",
    challenge: options.challenge,
    subjectId,
    payload,
  });

  return json({ challengeId, options });
}
