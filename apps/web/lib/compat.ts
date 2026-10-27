import { timingSafeEqual } from "node:crypto";
import { loadEnv } from "@cashow/config";

/**
 * Framework compatibility probes (plan §6, "Phase 0 compatibility gates").
 *
 * `/compat` exercises a Server Action and `/api/compat/stream` exercises a
 * streaming route with cancellation. Both are opt-in: without `COMPAT_TOKEN`
 * they answer 404, so a normal deployment exposes no probe surface.
 */

let cachedToken: string | null | undefined;

function compatToken(): string | null {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = loadEnv().COMPAT_TOKEN ?? null;
  return cachedToken;
}

export function compatEnabled(): boolean {
  return compatToken() !== null;
}

export function compatTokenMatches(provided: string | null | undefined): boolean {
  const expected = compatToken();
  if (expected === null) return false;
  if (provided === null || provided === undefined || provided === "") return false;

  const actual = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
}

/** Token from a probe request: explicit header first, then `?token=`. */
export function compatRequestToken(request: Request): string | null {
  const header = request.headers.get("x-cashow-compat-token");
  if (header !== null && header !== "") return header;
  return new URL(request.url).searchParams.get("token");
}

/** Indistinguishable from a route that does not exist. */
export function compatNotFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
