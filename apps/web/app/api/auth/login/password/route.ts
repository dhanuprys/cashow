import { z } from "zod";
import { getAuthConfig } from "@/lib/auth/config";
import { assertSameOrigin, clientAddress, json } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  checkPassword,
  hashToken,
  newSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "@/lib/auth/session";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  username: z.string().trim(),
  password: z.string().trim(),
});

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const config = getAuthConfig();

  // If password auth is disabled, redirect to passkey login
  if (!config.passwordAuthEnabled) {
    return json(
      { error: "Otentikasi kata sandi tidak aktif di konfigurasi ini." },
      { status: 403 },
    );
  }

  const limit = checkRateLimit(`login-password:${clientAddress(request)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan masuk. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Username atau kata sandi salah." }, { status: 401 });

  const db = await getDb();

  // Find user by username
  const user = await db.orm.public.User.where({ username: parsed.data.username }).first();
  if (user === null) return json({ error: "Username atau kata sandi salah." }, { status: 401 });

  // Check password
  const passwordValid = await checkPassword(parsed.data.password, user.password);

  if (!passwordValid) return json({ error: "Username atau kata sandi salah." }, { status: 401 });

  // Create session
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = sessionExpiry();

  await db.orm.public.Session.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress: clientAddress(request),
    userAgent: request.headers.get("user-agent"),
  });

  await setSessionCookie(token);

  return json({ ok: true });
}
