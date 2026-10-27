# 0007 — Passkey authentication without an auth framework

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The plan names Better Auth or Auth.js with "passkeys first", first-run owner
setup, and public signup disabled. Cashow has one owner (multi-user schema),
runs as a single web process on Bun, and stores data through Prisma 8's
contract-first client.

Both frameworks are built around a framework-specific database adapter. Better
Auth's Prisma adapter and Auth.js's Prisma adapter target the `@prisma/client`
API (`prisma.user.findUnique`, `prisma.account.create`, …). Prisma 8 does not
expose that client: queries go through the emitted contract
(`db.orm.public.User.where({ … })`, see ADR 0003). Porting an adapter would mean
maintaining a shim between two moving interfaces, for a feature surface that is
four WebAuthn ceremonies and two tables.

Passkeys also remove most of what an auth framework provides: there are no
password hashes to upgrade, no OAuth providers, no email verification, no
signup. Sessions are a random token plus a lookup.

## Decision

Implement passkeys directly with `@simplewebauthn/server` and keep every
persisted auth concept in our own contract:

| Concern          | Implementation                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Credentials      | `Passkey`: credential id, COSE public key (base64url text), signature counter, transports, backup state, label, `revokedAt` |
| Sessions         | `Session`: SHA-256 of a 32-byte random token, 30-day `expiresAt`, `revokedAt`, IP/UA for auditing                           |
| Ceremonies       | `AuthChallenge`: one row per ceremony, purpose-tagged (`REGISTRATION` / `AUTHENTICATION`), 5-minute TTL, single-use         |
| Login            | Discoverable credentials (`residentKey: "required"`, `userVerification: "preferred"`), so no username is typed              |
| Session cookie   | `cashow_session`, HttpOnly, `SameSite=Lax`, `Secure` on HTTPS, path `/`                                                     |
| First run        | `/setup` is open only while `User` is empty; optional `SETUP_TOKEN` for a server that is reachable before setup completes   |
| Signup           | No route exists. New users are not creatable from the UI, and adding a passkey requires an existing session                 |
| Cross-site POSTs | `SameSite=Lax` plus an `Origin` check in every auth route                                                                   |
| Rate limiting    | In-process fixed-window limiter per endpoint and client address (single-instance deployment, see ADR 0005)                  |
| Route guard      | `proxy.ts` redirects `/app/*` without a session cookie; server components re-validate the session against the database      |
| Revocation       | Revoking the last active passkey returns 409, so a passwordless account cannot be locked out by a mistaken click            |

Challenges are consumed by a conditional `UPDATE … WHERE "consumedAt" IS NULL`
inside the same transaction as the user/passkey/session writes, so a replayed
ceremony cannot create a second session. Expiry is compared in SQL
(`expiresAt > now()`), because `TimestamptzString` columns read as PostgreSQL
text, not ISO strings.

Relying-party settings come from `WEB_ORIGIN` (`WEBAUTHN_RP_ID` overrides the
hostname, `WEBAUTHN_RP_NAME` the display name). Passkeys are bound to the RP ID.

## Alternatives rejected

- **Better Auth / Auth.js with a Prisma adapter.** Adapter/API mismatch with
  Prisma 8 (above); we would own a shim and still write the WebAuthn handling.
- **Password auth.** A password store adds hashing, reset and phishing surface
  that the plan explicitly wants to avoid.
- **External identity provider.** Contradicts self-hosting; adds an account
  dependency and a network hop to log in.

## Consequences

- The auth surface is small enough to test end to end:
  `bun run test:e2e:auth` drives Chrome's virtual authenticator through setup,
  add-passkey, logout, login, revoke, and the last-passkey guard.
- Losing every passkey means editing the database (delete the owner's passkeys,
  then register a new one with a direct DB session); there is no email
  recovery, by design. Documented in the README.
- The in-memory rate limiter assumes one web replica. Two replicas would each
  allow the full window; acceptable for the target deployment, and the proxy
  still caps requests at the edge.
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` becomes relevant when more than one web
  instance runs. Single-instance self-hosting derives the key at build time.
- `AUTH_SECRET` is reserved for future signed tokens; sessions do not need it.
- The real owner passkey must be created **after** the permanent domain is
  settled (ADR 0006). Until then, `/setup` stays unused on production.
