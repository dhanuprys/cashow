import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createChallenge } from "@/lib/auth/challenges";
import { getAuthConfig } from "@/lib/auth/config";
import { assertSameOrigin, clientAddress, json } from "@/lib/auth/http";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  // Keyed by address only: the endpoint reveals nothing about which accounts
  // exist, so there is no user-enumeration signal to protect.
  const limit = checkRateLimit(`login-options:${clientAddress(request)}`, 20, 5 * 60 * 1000);
  if (!limit.allowed) {
    return json(
      { error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const config = getAuthConfig();

  // No `allowCredentials`: passkeys are discoverable, so the browser can offer
  // every account's credential without the server naming a user first.
  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "preferred",
  });

  const challengeId = await createChallenge({
    purpose: "AUTHENTICATION",
    challenge: options.challenge,
  });

  return json({ challengeId, options });
}
