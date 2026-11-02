import { z } from "zod";
import { getAuthConfig } from "@/lib/auth/config";
import { clientAddress, json } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const bodySchema = z.object({
  username: z.string().trim(),
});

export async function POST(request: Request) {
  const { assertSameOrigin } = await import("@/lib/auth/http");
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  const config = getAuthConfig();

  // If password auth is disabled, indicate passkey-only
  if (!config.passwordAuthEnabled) {
    return json({
      passwordAuthEnabled: false,
      message: "Otentikasi kata sandi tidak aktif.",
    });
  }

  const limit = checkRateLimit(
    `login-options-password:${clientAddress(request)}`,
    20,
    5 * 60 * 1000,
  );
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Username wajib diisi." }, { status: 400 });

  return json({ passwordAuthEnabled: true });
}
