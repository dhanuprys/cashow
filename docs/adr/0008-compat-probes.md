# 0008 — Token-gated framework compatibility probes

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Plan §6 requires the Phase 0 gates to stay as a smoke test, so a Bun or Next.js
upgrade cannot silently break production. Two of them are framework behaviours
rather than features:

- Server Actions must work through the production server and the reverse proxy.
- A streaming route must deliver chunks incrementally and stop work when the
  client aborts — the pattern the AI chat route depends on.

A probe page in the real deployment must not become a public endpoint, and it
must not require the owner's passkey (CI has no authenticator).

## Decision

Add two opt-in routes, gated by `COMPAT_TOKEN`:

| Route                                 | What it proves                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /compat?token=…` + its form post | A Server Action runs from a plain HTML form (no JavaScript) and re-renders   |
| `GET /api/compat/stream?token=…`      | NDJSON chunks are flushed incrementally; `?op=stats` reports observed aborts |

Details that matter:

- Without `COMPAT_TOKEN` both routes answer **404**. The check runs twice:
  `proxy.ts` (so the status is a real 404, not a streamed not-found) and the
  route/page (authoritative, using the validated environment).
- `/compat` is a blocking route (`instant = false` + `connection()`): the token
  check must decide the response before any HTML is flushed. It is a probe, not
  a page users navigate to, so losing partial prerendering is free.
- The streaming route keeps module-level counters so the smoke script can
  assert that a reader cancellation was seen on the server. This assumes a
  single web process, matching ADR 0005.
- `scripts/smoke-compat.ts` is HTTP-only, so the same script runs against
  `bun run dev`, the standalone image, or Compose behind Caddy:
  `SMOKE_BASE_URL=… COMPAT_TOKEN=… bun run smoke:compat`. CI runs it against
  `next start` on every push.

## Alternatives rejected

- **Authenticate the probes with the owner session.** CI has no passkey, and
  minting a session row in scripts would either create a phantom user (closing
  `/setup`) or require database access from the probe.
- **Ship the probes always on with no token.** They would be a public
  Server Action and a public streaming endpoint.
- **Use a Playwright browser for the Server Action.** Works, but it hides
  failures behind the client runtime and cannot run through the proxy in a
  minimal CI image. The no-JS form post is stricter and simpler.

## Consequences

- A deployment that sets `COMPAT_TOKEN` exposes an unauthenticated probe; it is
  documented as CI-only and disabled by default. Do not set it on the instance
  that holds real data.
- The probe counters and the rate limiter both assume one web replica; a
  multi-replica deployment would need shared state or the probes left disabled.
- The whole gate is one script plus two routes, so a future Next upgrade tells
  us immediately whether Server Actions, streaming, and abort still behave.
