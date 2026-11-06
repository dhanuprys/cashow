import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import {
  generateOAuthState,
  generatePKCEVerifier,
  getGoogleOAuthUrl,
  setOAuthCookies,
} from "@/lib/auth/google";
import { clientAddress } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function GET(request: Request) {
  await connection();

  const limit = checkRateLimit(`auth-google-init:${clientAddress(request)}`, 20, 5 * 60 * 1000);
  if (!limit.allowed) {
    return redirect(
      `/login?error=${encodeURIComponent("Terlalu banyak permintaan otentikasi. Coba lagi nanti.")}`,
    );
  }

  const config = getAuthConfig(request);
  if (!config.googleAuthEnabled) {
    return new Response("Login dengan Google belum diaktifkan.", { status: 403 });
  }

  const url = new URL(request.url);
  const rawReturnTo = url.searchParams.get("returnTo");
  const returnTo = rawReturnTo?.startsWith("/app") ? rawReturnTo : null;

  const state = generateOAuthState();
  const codeVerifier = generatePKCEVerifier();
  await setOAuthCookies(state, codeVerifier, returnTo);

  const authUrl = getGoogleOAuthUrl(request, state, codeVerifier);
  return redirect(authUrl);
}
