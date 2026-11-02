import { ensureDefaultLedger } from "@cashow/services";
import { z } from "zod";
import { assertSameOrigin, clientAddress, json } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  hashPassword,
  hashToken,
  newSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "@/lib/auth/session";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(64, "Maksimal 64 karakter."),
  name: z.string().trim().max(80).optional(),
  avatar: z.string().trim().max(64).optional(),
  bio: z.string().trim().max(250).optional(),
  password: z
    .string()
    .trim()
    .min(6, "Kata sandi minimal 6 karakter.")
    .max(128, "Maksimal 128 karakter."),
});

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const limit = checkRateLimit(`register-password:${clientAddress(request)}`, 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return json(
      { error: parsed.error.issues ? parsed.error.issues[0].message : "Data tidak valid." },
      { status: 400 },
    );

  const db = await getDb();

  // Check if username already exists
  const existingUser = await db.orm.public.User.where({ username: parsed.data.username }).first();
  if (existingUser !== null) {
    return json({ error: "Username sudah terdaftar." }, { status: 409 });
  }

  // Hash the password
  const hashedPassword = await hashPassword(parsed.data.password);
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = sessionExpiry();

  await db.transaction(async (tx) => {
    // Create the user with username and password
    await tx.orm.public.User.create({
      username: parsed.data.username,
      name: parsed.data.name || null,
      avatar: parsed.data.avatar || null,
      bio: parsed.data.bio || null,
      password: hashedPassword,
    });

    const newUser = await tx.orm.public.User.where({ username: parsed.data.username }).first();
    if (newUser === null) throw new Error("Gagal membuat pengguna.");

    // Seed default ledger accounts and categories
    await ensureDefaultLedger(tx, newUser.id);

    // Sign the new user in.
    await tx.orm.public.Session.create({
      userId: newUser.id,
      tokenHash,
      expiresAt,
      ipAddress: clientAddress(request),
      userAgent: request.headers.get("user-agent"),
    });
  });

  await setSessionCookie(token);

  return json({ ok: true });
}
