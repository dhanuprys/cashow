import { getAuthConfig } from "./config";

/** JSON response with `no-store` so auth data never lands in a cache. */
export function json(body: unknown, init: ResponseInit = {}): Response {
  const responseHeaders = new Headers(init.headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers: responseHeaders });
}

export function badRequest(message: string, detail?: string): Response {
  return json({ error: message, ...(detail === undefined ? {} : { detail }) }, { status: 400 });
}

export function unauthorized(message = "Sesi tidak valid. Silakan masuk kembali."): Response {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message: string): Response {
  return json({ error: message }, { status: 403 });
}

export function conflict(message: string): Response {
  return json({ error: message }, { status: 409 });
}

/** Surface the underlying reason in development only. */
export function errorDetail(error: unknown): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reject cross-site state-changing requests. `SameSite=Lax` already keeps the
 * session cookie off cross-site POSTs; this is the second lock on the door.
 * Requests without an `Origin` header (curl, native clients) are allowed.
 *
 * A request is same-origin when its `Origin` matches the `Host` the client
 * actually used. This keeps the app usable from both `localhost` and a LAN IP
 * in development without loosening protection: a browser cannot forge `Host`,
 * and a cross-site page sends its own origin here.
 */
export function assertSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null) return null; // allow curl/native clients

  let requestOrigin: URL;
  try {
    requestOrigin = new URL(origin);
  } catch {
    return forbidden("Permintaan berasal dari origin yang tidak dikenal.");
  }

  const host = request.headers.get("host");
  if (host !== null && requestOrigin.host === host) return null;

  const authConfig = getAuthConfig(request);
  if (authConfig.origins.includes(requestOrigin.origin)) return null;

  return forbidden("Permintaan berasal dari origin yang tidak dikenal.");
}

/** Best-effort client address for rate limiting and session auditing. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first !== "") return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
