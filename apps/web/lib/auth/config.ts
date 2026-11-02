import { loadEnv } from "@cashow/config";

/**
 * Auth configuration derived from the same validated environment as the rest
 * of the app. Supports both passkey and username/password authentication.
 */
export type AuthConfig = {
  /** Canonical primary origin, e.g. `https://cashow.example.com`. */
  origin: string;
  /** List of all permitted origins for multi-domain setups. */
  origins: string[];
  /** WebAuthn relying party ID, e.g. `cashow.example.com` or `dev.cashow.my.id`. */
  rpID: string;
  /** Human-readable relying party name shown by the browser. */
  rpName: string;
  /** HTTPS origins get `Secure` cookies; plain localhost does not. */
  secureCookies: boolean;
  /** True when `/setup` must be unlocked with `SETUP_TOKEN`. */
  setupTokenRequired: boolean;
  setupToken: string | undefined;
  /** True when username/password auth is enabled. */
  passwordAuthEnabled: boolean;
};

export function getAuthConfig(request?: Request): AuthConfig {
  const env = loadEnv();

  // Parse all comma-separated origins
  const rawOrigins = env.WEB_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = rawOrigins.map((item) => {
    try {
      return new URL(item).origin;
    } catch {
      return item;
    }
  });

  const primaryOrigin = origins[0] ?? "http://localhost:3000";
  const primaryUrl = new URL(primaryOrigin);

  // If a request is provided, try to match its Host header to determine the matching origin and rpID
  let activeOrigin = primaryOrigin;
  let activeRpId = env.WEBAUTHN_RP_ID ?? primaryUrl.hostname;

  if (request) {
    const host = request.headers.get("host");
    const originHeader = request.headers.get("origin");

    if (originHeader) {
      const matched = origins.find((o) => o === originHeader);
      if (matched) {
        activeOrigin = matched;
        try {
          activeRpId = env.WEBAUTHN_RP_ID ?? new URL(matched).hostname;
        } catch {}
      }
    } else if (host) {
      const matched = origins.find((o) => {
        try {
          return new URL(o).host === host;
        } catch {
          return false;
        }
      });
      if (matched) {
        activeOrigin = matched;
        try {
          activeRpId = env.WEBAUTHN_RP_ID ?? new URL(matched).hostname;
        } catch {}
      }
    }
  }

  const activeUrl = new URL(activeOrigin);

  return {
    origin: activeOrigin,
    origins: origins.length > 0 ? origins : [primaryOrigin],
    rpID: activeRpId,
    rpName: env.WEBAUTHN_RP_NAME,
    secureCookies: activeUrl.protocol === "https:",
    setupTokenRequired: env.SETUP_TOKEN !== undefined,
    setupToken: env.SETUP_TOKEN,
    passwordAuthEnabled: env.WEB_PASSWORD_AUTH !== "false",
  };
}
