import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAuthConfig } from "./config";

const GOOGLE_STATE_COOKIE = "cashow_google_oauth_state";
const GOOGLE_VERIFIER_COOKIE = "cashow_google_oauth_verifier";
const GOOGLE_RETURN_TO_COOKIE = "cashow_google_oauth_returnto";
const GOOGLE_OAUTH_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface GoogleUserInfo {
  sub: string; // Google user ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function generatePKCEVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function derivePKCEChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function setOAuthCookies(
  state: string,
  codeVerifier: string,
  returnTo?: string | null,
): Promise<void> {
  const store = await cookies();
  const { secureCookies } = getAuthConfig();
  const maxAge = Math.floor(GOOGLE_OAUTH_TTL_MS / 1000);

  store.set({
    name: GOOGLE_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge,
  });

  store.set({
    name: GOOGLE_VERIFIER_COOKIE,
    value: codeVerifier,
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge,
  });

  if (returnTo?.startsWith("/app")) {
    store.set({
      name: GOOGLE_RETURN_TO_COOKIE,
      value: returnTo,
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      maxAge,
    });
  } else {
    store.delete(GOOGLE_RETURN_TO_COOKIE);
  }
}

export async function verifyAndClearOAuthState(
  receivedState: string,
): Promise<{ valid: boolean; codeVerifier: string | null; returnTo: string | null }> {
  const store = await cookies();
  const stateCookie = store.get(GOOGLE_STATE_COOKIE)?.value;
  const verifierCookie = store.get(GOOGLE_VERIFIER_COOKIE)?.value ?? null;
  const returnToCookie = store.get(GOOGLE_RETURN_TO_COOKIE)?.value ?? null;

  store.delete(GOOGLE_STATE_COOKIE);
  store.delete(GOOGLE_VERIFIER_COOKIE);
  store.delete(GOOGLE_RETURN_TO_COOKIE);

  if (!stateCookie || !receivedState || stateCookie.length !== receivedState.length) {
    return { valid: false, codeVerifier: null, returnTo: null };
  }

  const isValid = timingSafeEqual(Buffer.from(stateCookie), Buffer.from(receivedState));
  const safeReturnTo = returnToCookie?.startsWith("/app") ? returnToCookie : null;

  return { valid: isValid, codeVerifier: verifierCookie, returnTo: safeReturnTo };
}

export function getGoogleOAuthUrl(request: Request, state: string, codeVerifier: string): string {
  const config = getAuthConfig(request);
  if (!config.googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const redirectUri = `${config.origin}/api/auth/google/callback`;
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const codeChallenge = derivePKCEChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return `${rootUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  request: Request,
  codeVerifier: string | null,
): Promise<{ accessToken: string; idToken?: string }> {
  const config = getAuthConfig(request);
  if (!config.googleClientId || !config.googleClientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const redirectUri = `${config.origin}/api/auth/google/callback`;
  const tokenEndpoint = "https://oauth2.googleapis.com/token";

  const bodyParams: Record<string, string> = {
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  if (codeVerifier) {
    bodyParams.code_verifier = codeVerifier;
  }

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(bodyParams),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    id_token?: string;
  };

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
  };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const userinfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";

  const response = await fetch(userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Failed to fetch Google user info (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as GoogleUserInfo;
}
