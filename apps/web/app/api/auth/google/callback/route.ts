import { ensureDefaultLedger } from "@cashow/services";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  verifyAndClearOAuthState,
} from "@/lib/auth/google";
import { clientAddress } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { hashToken, newSessionToken, sessionExpiry, setSessionCookie } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/setup";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  await connection();

  const limit = checkRateLimit(`auth-google-cb:${clientAddress(request)}`, 15, 5 * 60 * 1000);
  if (!limit.allowed) {
    return redirect(
      `/login?error=${encodeURIComponent("Terlalu banyak percobaan. Coba lagi nanti.")}`,
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return redirect(
      `/login?error=${encodeURIComponent("Otentikasi Google dibatalkan atau ditolak.")}`,
    );
  }

  if (!code || !state) {
    return redirect(
      `/login?error=${encodeURIComponent("Permintaan otentikasi Google tidak lengkap.")}`,
    );
  }

  const { valid, codeVerifier, returnTo } = await verifyAndClearOAuthState(state);
  if (!valid) {
    return redirect(
      `/login?error=${encodeURIComponent(
        "Sesi otentikasi Google kedaluwarsa atau tidak valid. Silakan coba lagi.",
      )}`,
    );
  }

  try {
    const { accessToken } = await exchangeCodeForTokens(code, request, codeVerifier);
    const googleUser = await fetchGoogleUserInfo(accessToken);

    if (!googleUser.sub) {
      return redirect(`/login?error=${encodeURIComponent("Informasi profil Google tidak valid.")}`);
    }

    const db = await getDb();
    const config = getAuthConfig(request);

    // 1. Check if user already exists with this googleId
    let user = await db.orm.public.User.where({ googleId: googleUser.sub }).first();

    // 2. If not found by googleId, check by verified email to link account
    if (user === null && googleUser.email && googleUser.email_verified) {
      user = await db.orm.public.User.where({ email: googleUser.email }).first();
      if (user !== null) {
        // Link googleId to this existing account
        await db.orm.public.User.where({ id: user.id }).update({
          googleId: googleUser.sub,
        });
      }
    }

    // 3. If still no user exists, check setup security gate & create user
    if (user === null) {
      const anyUserExists = await hasAnyUser();
      // If no users exist and server is gated with SETUP_TOKEN, block direct Google auto-creation
      if (!anyUserExists && config.setupTokenRequired) {
        return redirect(
          `/setup?error=${encodeURIComponent(
            "Setup awal peladen memerlukan token konfigurasi. Silakan selesaikan setup terlebih dahulu.",
          )}`,
        );
      }

      // Pick random/default avatar
      const defaultAvatars = ["alex", "maya", "budi", "siti", "rupiah", "growth", "zen", "spark"];
      const chosenAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];

      const token = newSessionToken();
      const tokenHash = hashToken(token);
      const expiresAt = sessionExpiry();

      let createdUserId = "";

      await db.transaction(async (tx) => {
        await tx.orm.public.User.create({
          email: googleUser.email || null,
          googleId: googleUser.sub,
          name:
            googleUser.name ||
            (googleUser.email ? googleUser.email.split("@")[0] : "Pengguna Cashow"),
          avatar: chosenAvatar,
        });

        // Query back created user to retrieve the ID
        const createdUser = await tx.orm.public.User.where({ googleId: googleUser.sub }).first();
        if (createdUser === null) throw new Error("Gagal membuat akun pengguna Google.");
        createdUserId = createdUser.id;

        // Ensure default accounts and categories for cashflow tracking
        await ensureDefaultLedger(tx, createdUserId);

        // Create new active session
        await tx.orm.public.Session.create({
          userId: createdUserId,
          tokenHash,
          expiresAt,
          ipAddress: clientAddress(request),
          userAgent: request.headers.get("user-agent"),
        });
      });

      await setSessionCookie(token);
      return redirect(returnTo ?? "/app");
    }

    // 4. User exists: issue new session
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
    return redirect(returnTo ?? "/app");
  } catch (err) {
    console.error("[Google OAuth Callback Error]", err);
    return redirect(
      `/login?error=${encodeURIComponent("Gagal menyelesaikan otentikasi dengan Google. Silakan coba lagi.")}`,
    );
  }
}
