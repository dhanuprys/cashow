import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getAuthConfig } from "./config";

export const SESSION_COOKIE = "cashow_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  timezone: string;
  currency: string;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + SESSION_TTL_MS).toISOString();
}

/** Write the session cookie (call only from a route handler or server action). */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  const { secureCookies } = getAuthConfig();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function createSession(
  userId: string,
  request: Request,
): Promise<{ token: string; sessionId: string }> {
  const db = await getDb();
  const token = newSessionToken();

  const session = await db.orm.public.Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: sessionExpiry(),
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  });

  return { token, sessionId: session.id };
}

/** Resolve the signed-in user from the session cookie, or `null`. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || token === "") return null;

  const db = await getDb();
  const session = await db.orm.public.Session.where({ tokenHash: hashToken(token) })
    .where((row) => row.revokedAt.isNull())
    .where((row) => row.expiresAt.gt(new Date().toISOString()))
    .first();
  if (session === null) return null;

  const user = await db.orm.public.User.where({ id: session.userId })
    .select("id", "name", "email", "timezone", "currency")
    .first();

  return user;
}

/**
 * Server-component guard: redirect unauthenticated visitors to `/login`.
 * Pages must call this from inside a Suspense boundary because it reads the
 * request-time cookie (Cache Components).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user === null) redirect("/login");
  return user;
}

/** Revoke the current session (idempotent). */
export async function revokeCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token !== undefined && token !== "") {
    const db = await getDb();
    await db.orm.public.Session.where({ tokenHash: hashToken(token) }).update({
      revokedAt: new Date().toISOString(),
    });
  }
  await clearSessionCookie();
}
