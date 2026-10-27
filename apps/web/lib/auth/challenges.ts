import { getDb } from "@/lib/db";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type RegistrationPayload =
  | { kind: "setup"; name: string; email: string | null }
  | { kind: "add" };

export function challengeExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
}

export async function createChallenge(input: {
  purpose: "REGISTRATION" | "AUTHENTICATION";
  challenge: string;
  subjectId?: string;
  payload?: RegistrationPayload;
}): Promise<string> {
  const db = await getDb();

  // Opportunistic cleanup keeps the table from growing forever without a
  // scheduled job. Expired rows are useless by definition.
  await db.orm.public.AuthChallenge.where((c) =>
    c.expiresAt.lt(new Date().toISOString()),
  ).deleteAll();

  const row = await db.orm.public.AuthChallenge.create({
    purpose: input.purpose,
    challenge: input.challenge,
    subjectId: input.subjectId ?? null,
    payload: input.payload ?? null,
    expiresAt: challengeExpiry(),
  });

  return row.id;
}

export type PendingChallenge = {
  id: string;
  purpose: "REGISTRATION" | "AUTHENTICATION";
  challenge: string;
  subjectId: string | null;
  payload: unknown;
};

/**
 * Load an unconsumed, unexpired challenge. The purpose check prevents a
 * registration challenge from being replayed as an authentication ceremony.
 */
export async function loadPendingChallenge(
  id: string,
  purpose: "REGISTRATION" | "AUTHENTICATION",
): Promise<PendingChallenge | null> {
  const db = await getDb();
  const row = await db.orm.public.AuthChallenge.where({ id })
    .where((c) => c.consumedAt.isNull())
    .where((c) => c.expiresAt.gt(new Date().toISOString()))
    .first();

  if (row === null) return null;
  if (row.purpose !== purpose) return null;

  return {
    id: row.id,
    purpose: row.purpose,
    challenge: row.challenge,
    subjectId: row.subjectId,
    payload: row.payload,
  };
}

export function readRegistrationPayload(payload: unknown): RegistrationPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;

  if (record.kind === "add") return { kind: "add" };
  if (
    record.kind === "setup" &&
    typeof record.name === "string" &&
    (record.email === null || typeof record.email === "string")
  ) {
    return { kind: "setup", name: record.name, email: record.email };
  }

  return null;
}
