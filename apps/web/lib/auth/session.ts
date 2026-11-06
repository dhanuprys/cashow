import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthConfig } from "./config";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const PASSWORD_SCHEME = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

export const SESSION_COOKIE = "cashow_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  email: string | null;
  username: string | null;
  googleId: string | null;
  hasPassword: boolean;
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

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the session cookie, or `null`. */
export async function getSessionUser(): Promise<SessionUser | null> {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || token === "") return null;

  const db = await getDb();
  const session = await db.orm.public.Session.where({ tokenHash: hashToken(token) })
    .where((row) => row.revokedAt.isNull())
    .where((row) => row.expiresAt.gt(new Date().toISOString()))
    .first();
  if (session === null) return null;

  // Load user data - supports passkey, password, and Google OAuth users
  const user = await db.orm.public.User.where({ id: session.userId })
    .select(
      "id",
      "name",
      "avatar",
      "bio",
      "email",
      "username",
      "googleId",
      "timezone",
      "currency",
      "password",
    )
    .first();

  if (user === null) return null;

  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    bio: user.bio ?? null,
    email: user.email,
    username: user.username,
    googleId: user.googleId ?? null,
    hasPassword: user.password !== null && user.password !== "",
    timezone: user.timezone,
    currency: user.currency,
  };
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

/**
 * Hash a password with scrypt from `node:crypto`.
 *
 * Next.js runs route handlers on Node, so `Bun.crypto` is not available even
 * when the dev server is launched with Bun. Stored format:
 * `scrypt$<salt base64url>$<key base64url>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH);
  return `${PASSWORD_SCHEME}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** Verify a password against a value produced by {@link hashPassword}. */
export async function checkPassword(
  candidate: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (hash === null || hash === undefined || hash === "") return false;

  const [scheme, saltPart, keyPart] = hash.split("$");
  if (scheme !== PASSWORD_SCHEME || saltPart === undefined || keyPart === undefined) {
    return false;
  }

  const expected = Buffer.from(keyPart, "base64url");
  if (expected.length === 0) return false;

  const actual = await scryptAsync(candidate, Buffer.from(saltPart, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}
