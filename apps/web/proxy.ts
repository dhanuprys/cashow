import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "cashow_session";

/**
 * Edge-level, optimistic checks only — the real session validation and
 * authorization happen in server components and route handlers.
 *
 *   1. Framework probes (`/compat`, `/api/compat/*`) answer 404 unless the
 *      request presents `COMPAT_TOKEN`. The page and route re-check the token;
 *      this early check exists so a disabled probe returns a real 404 status
 *      instead of a streamed not-found (Cache Components flushes a shell).
 *   2. `/app/*` without a session cookie → `/login` (no DB round-trip).
 *   3. Security headers on every response. Caddy adds HSTS and edge limits;
 *      these belong to the app so they also apply when running on localhost.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProbePath(pathname) && !probeTokenMatches(request)) {
    return withSecurityHeaders(
      new NextResponse("Not found", {
        status: 404,
        headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  if (
    !request.cookies.has(SESSION_COOKIE) &&
    (pathname === "/app" || pathname.startsWith("/app/"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return withSecurityHeaders(NextResponse.redirect(url));
  }

  return withSecurityHeaders(NextResponse.next());
}

function isProbePath(pathname: string): boolean {
  return (
    pathname === "/compat" || pathname === "/api/compat" || pathname.startsWith("/api/compat/")
  );
}

/**
 * Constant-time comparison against the raw environment variable. The proxy
 * cannot use `@cashow/config` (it must stay dependency-free), so the validated
 * check stays in `lib/compat.ts`; this is the pre-render gate only.
 */
function probeTokenMatches(request: NextRequest): boolean {
  const expected = process.env.COMPAT_TOKEN;
  if (expected === undefined || expected === "") return false;

  const provided =
    request.headers.get("x-cashow-compat-token") ?? request.nextUrl.searchParams.get("token");
  if (provided === null || provided.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  // Skip static assets; a passkey page still needs the headers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
