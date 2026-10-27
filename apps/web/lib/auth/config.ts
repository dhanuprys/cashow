import { loadEnv } from "@cashow/config";

/**
 * Auth configuration derived from the same validated environment as the rest
 * of the app. Passkeys are bound to the origin/RP ID, so both come from
 * `WEB_ORIGIN` (or an explicit `WEBAUTHN_RP_ID` override).
 */
export type AuthConfig = {
  /** Canonical origin, e.g. `https://cashow.example.com`. */
  origin: string;
  /** WebAuthn relying party ID, e.g. `cashow.example.com`. */
  rpID: string;
  /** Human-readable relying party name shown by the browser. */
  rpName: string;
  /** HTTPS origins get `Secure` cookies; plain localhost does not. */
  secureCookies: boolean;
  /** True when `/setup` must be unlocked with `SETUP_TOKEN`. */
  setupTokenRequired: boolean;
  setupToken: string | undefined;
};

let cached: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  if (cached !== undefined) return cached;

  const env = loadEnv();
  const origin = new URL(env.WEB_ORIGIN);

  cached = {
    origin: origin.origin,
    rpID: env.WEBAUTHN_RP_ID ?? origin.hostname,
    rpName: env.WEBAUTHN_RP_NAME,
    secureCookies: origin.protocol === "https:",
    setupTokenRequired: env.SETUP_TOKEN !== undefined,
    setupToken: env.SETUP_TOKEN,
  };

  return cached;
}
