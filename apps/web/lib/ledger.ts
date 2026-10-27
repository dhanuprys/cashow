import type { Result } from "@cashow/services";
import { getSessionUser } from "./auth/session";
import { getDb } from "./db";

export interface LedgerSession {
  db: Awaited<ReturnType<typeof getDb>>;
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  ctx: { db: Awaited<ReturnType<typeof getDb>>; userId: string };
}

/** The signed-in owner plus a scoped service context, or `null` for APIs. */
export async function findLedgerSession(): Promise<LedgerSession | null> {
  const user = await getSessionUser();
  if (user === null) return null;
  const db = await getDb();
  return { db, user, ctx: { db, userId: user.id } };
}

/** The signed-in owner for a server action; throws when the session is gone. */
export async function requireLedgerSession(): Promise<LedgerSession> {
  const session = await findLedgerSession();
  if (session === null) {
    throw new Error("Sesi berakhir. Silakan masuk kembali.");
  }
  return session;
}

/** Turn an expected service failure into a thrown error an action can report. */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

/** Read the dotted ledger code from an error without narrowing the whole type. */
export function ledgerErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
