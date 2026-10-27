# Cashow

**Ikuti ke mana uangmu mengalir.** A self-hosted money traceability ledger:
income arrives, expenses draw from it through explicit allocations, and every
balance is derived rather than stored.

This repository is the Phase 0 foundation: the monorepo, PostgreSQL schema and
migrations, environment validation, the deployment stack, and the test gates.
Feature work (auth, ledger CRUD, rules, AI) builds on top.

## Stack

| Layer                     | Choice                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| Runtime / package manager | Bun 1.4.2, workspaces, one `bun.lock`                            |
| Web                       | Next.js 16 App Router, Tailwind v4, shadcn/ui, standalone output |
| Database                  | PostgreSQL 17 (`pgvector/pgvector:pg17`)                         |
| Data layer                | Prisma 8 contract-first (`contract.prisma` → `contract.json`)    |
| Validation                | Zod environment schema, validated at boot                        |
| Lint / format             | Biome 2                                                          |
| Deployment                | Docker Compose: Caddy, web, worker, migrate, Postgres, backup    |
| Money                     | 64-bit integer rupiah (`bigint` / `BigInt`), never floats        |

## Layout

```
apps/web                 Next.js app and health endpoints
apps/worker              background worker entrypoint
packages/domain          money, dates, allocation math, formatters (pure)
packages/config          Zod env schema + `_FILE` secret loading
packages/db              Prisma contract, client, migrations, generated types
packages/services        use cases (wired in later phases)
packages/notify          notification channels
packages/ai              DeepSeek / AI SDK integration
deploy                   Caddyfile, backup and restore scripts, backup image
docs/adr                 architecture decision records
scripts                  smoke test and one-off utilities
```

## Prerequisites

- [Bun](https://bun.sh) 1.4.2
- PostgreSQL 17 reachable over TCP (local container or the Compose service)
- Docker with Compose v2 for the deployment stack

## Local development

```bash
cp .env.example .env          # fill in DATABASE_URL and secrets
bun install
bun run db:migrate            # apply migrations to an empty database
bun run dev                   # http://localhost:3000
```

`packages/db/.env` may hold a separate `DATABASE_URL` for the Prisma CLI; the
root `.env` is canonical and is also the fallback for the CLI. `bun run dev`,
`start` and `worker` load the root `.env` explicitly (`bun --env-file=.env`),
so one file configures every local process.

Create the database once if you are not using Compose:

```bash
createdb -h localhost -U default cashow
```

### Useful commands

| Command                            | What it does                                       |
| ---------------------------------- | -------------------------------------------------- |
| `bun run dev`                      | Next.js dev server (Turbopack)                     |
| `bun run build` / `bun run start`  | production build / serve                           |
| `bun run worker`                   | run the background worker                          |
| `bun run lint` / `bun run format`  | Biome check / rewrite                              |
| `bun run typecheck`                | `tsc` for packages and the web app                 |
| `bun run test`                     | `bun test` (domain unit tests)                     |
| `bun run smoke`                    | write/read a `BigInt` row through the typed client |
| `bun run db:migrate`               | apply pending migrations                           |
| `bun run db:status`                | migration path and pending state                   |
| `bun run db:verify`                | compare the live schema with the contract          |
| `bun run db:plan -- --name <slug>` | plan a migration from contract changes             |
| `bun run db:emit`                  | re-emit `contract.json` / `contract.d.ts`          |

> `bun run typecheck` needs Next.js route types, which `bun run build` generates
> on a fresh checkout. Run the build once before typechecking `apps/web`.

### Schema workflow

1. Edit `packages/db/src/prisma/contract.prisma`.
2. `bun run db:emit` to regenerate the typed contract.
3. `bun run db:plan -- --name <slug>` and review the new package under
   `packages/db/migrations/app/`.
4. `bun run db:migrate`, then `bun run db:verify`.

Cross-row rules that a SQL `CHECK` cannot express (allocation sums) are
PL/pgSQL triggers created by the baseline migration. If you edit a migration by
hand, re-run it with Node to re-emit `ops.json` and attest the package, then run
`prisma migration check`.

## Deployment

```bash
cp .env.example .env
# set POSTGRES_PASSWORD, CASHOW_DOMAIN and WEB_ORIGIN
docker compose up -d --build
```

Compose starts Postgres, waits for it to be healthy, runs the one-shot
`migrate` service, then starts `web` and `worker` behind Caddy. Only the proxy
publishes ports (80/443). Postgres is on an internal network with no host port.
`web` and `worker` run as a non-root user with a read-only root filesystem.

- **Access:** default to a private network (Tailscale/WireGuard) and point
  `CASHOW_DOMAIN` at the private name. Cloudflare Tunnel and a public domain are
  documented alternatives — see [ADR 0006](docs/adr/0006-access-option.md).
- **Domain first:** passkeys are bound to `CASHOW_DOMAIN`; changing it later
  breaks every passkey and push subscription.
- **Secrets:** put them in `.env` for a small deployment, or use
  `<NAME>_FILE=/run/secrets/<name>` with Docker secrets/read-only mounts. Images
  contain no secrets.
- **Secrets to keep:** database password, `AUTH_SECRET`, VAPID private key,
  DeepSeek key, backup age key. Keep an offline copy; without the age key,
  encrypted backups are unreadable.

### Backups and restore

The `backup` service is opt-in so the base stack starts without a key:

```bash
mkdir -p secrets
age-keygen -o secrets/age.key          # keep the private key offline
# put the public key in BACKUP_AGE_RECIPIENT in .env
docker compose --profile backup up -d
```

It runs nightly at 02:15 UTC: `pg_dump` (custom format) → `age` encryption →
optional `rclone` upload, with retention. `deploy/restore.sh` restores a dump
into a throwaway database and checks that the five ledger tables exist. Run a
restore drill monthly; a backup that was never restored is a hope, not a backup.

```bash
docker compose run --rm backup /usr/local/bin/restore.sh \
  /backups/cashow-20261027T021500Z.dump.age cashow_drill
```

### Health endpoints

- `GET /api/health` — liveness (process is up)
- `GET /api/ready` — readiness (Postgres reachable and schema queryable)

## Verification gates

CI runs, in order: frozen install, lint/format, production build, typecheck,
unit tests, migrations against an empty Postgres, `db verify`, the database
smoke test, and a Docker build of both runtime targets.

## Decisions

Architecture decisions live in [docs/adr](docs/adr/). The open one is the
access option; it must be settled before passkeys are created.

## License

Private project. All rights reserved.
