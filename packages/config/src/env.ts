import { readFileSync } from "node:fs";
import { z } from "zod";

/**
 * The single environment schema (section 7). Validated at boot so the app and
 * worker refuse to start on a missing or invalid value. Secrets stay server-side
 * and are never sent to the client bundle.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** PostgreSQL connection string (user-scoped, read from Docker secrets). */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Origin of the web app, used for cookies, passkeys and push. */
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  /** Auth. Passkey sessions are random and hashed at rest; kept for future signed tokens. */
  AUTH_SECRET: z.string().min(1).optional(),

  /**
   * Optional one-time token for `/setup`. When set, the first-run owner must
   * present it. Leave empty for a purely local install.
   */
  SETUP_TOKEN: z.string().min(1).optional(),

  /**
   * WebAuthn relying party. Defaults to the `WEB_ORIGIN` hostname. Override
   * `WEBAUTHN_RP_ID` only when passkeys must be shared across subdomains.
   */
  WEBAUTHN_RP_ID: z.string().min(1).optional(),
  WEBAUTHN_RP_NAME: z.string().min(1).default("Cashow"),

  /**
   * Opt-in token for the framework compatibility probes (`/compat` and
   * `/api/compat/stream`). Unset in normal operation, which makes both routes
   * answer 404; the CI smoke test sets it for the duration of the run.
   */
  COMPAT_TOKEN: z.string().min(16).optional(),

  /** DeepSeek models are kept in env because they have been renamed before. */
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-flash"),
  DEEPSEEK_PRO_MODEL: z.string().default("deepseek-v4-pro"),

  /** VAPID keys for Web Push. Private key stays server-side. */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().optional(),

  /** Notification channels (optional, off by default). */
  NTFY_TOPIC: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  SMTP_URL: z.string().optional(),

  /** Logging. */
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

const SECRET_KEYS = Object.keys(envSchema.shape) as (keyof Env)[];

/**
 * Resolve `<KEY>_FILE` secrets (Docker secrets, read-only mounted files) and
 * treat empty strings as unset, so a Compose `VAR:` line with no value uses the
 * schema default instead of failing `min(1)`.
 */
function normalizeEnvironment(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const resolved: Record<string, string | undefined> = { ...env };

  for (const key of SECRET_KEYS) {
    const filePath = env[`${key}_FILE`];
    if (filePath === undefined || filePath === "") continue;
    if (resolved[key] !== undefined && resolved[key] !== "") continue;

    try {
      resolved[key] = readFileSync(filePath, "utf8").trim();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not read ${key}_FILE at ${filePath}: ${reason}`);
    }
  }

  for (const key of Object.keys(resolved)) {
    if (resolved[key] === "") resolved[key] = undefined;
  }

  return resolved;
}

/**
 * Validate an environment object and return the typed, defaulted config.
 * Throws with every validation issue listed when invalid.
 */
export function loadEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(normalizeEnvironment(env));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/** True when AI features should be disabled (no DeepSeek key configured). */
export function isAiEnabled(env: Env): boolean {
  return env.DEEPSEEK_API_KEY !== undefined && env.DEEPSEEK_API_KEY !== "";
}
