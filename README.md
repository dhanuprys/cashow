# Cashow

**Ikuti ke mana uangmu mengalir.** A self-hosted money traceability ledger:
income arrives, expenses draw from it through explicit allocations, and every
balance is derived rather than stored.

This repository is Phase 0, the Phase 1 core ledger, and Phase 2 chains and
balances: the monorepo, PostgreSQL schema and migrations, environment
validation, passkey authentication, the deployment stack, the seeded
performance benchmark, the account and category pages, income/expense capture
with quick add, allocation of expenses to incomes, attachments, payment plans
with derived status, balance snapshots and reconciliation, checkpoints that lock
settled periods, transfers with fees, audit log, soft delete, and a
transactional outbox. Budgets, rules, notifications and AI build on top.

## Stack

| Layer                     | Choice                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| Runtime / package manager | Bun 1.4.2, workspaces, one `bun.lock`                            |
| Web                       | Next.js 16 App Router, Tailwind v4, shadcn/ui, standalone output |
| Database                  | PostgreSQL 17 (`pgvector/pgvector:pg17`)                         |
| Data layer                | Prisma 8 contract-first (`contract.prisma` → `contract.json`)    |
| Auth                      | Passkeys via `@simplewebauthn/server`, sessions in Postgres      |
| Validation                | Zod environment schema, validated at boot                        |
| Lint / format             | Biome 2                                                          |
| Deployment                | Docker Compose: Caddy, web, worker, migrate, Postgres, backup    |
| Money                     | 64-bit integer rupiah (`bigint` / `BigInt`), never floats        |
| Attachments               | metadata in Postgres, bytes on a local volume (ADR 0009)         |

## Layout

```
apps/web                 Next.js app and health endpoints
apps/worker              background worker entrypoint
packages/domain          money, dates, allocation math, formatters (pure)
packages/config          Zod env schema + `_FILE` secret loading
packages/db              Prisma contract, client, migrations, generated types
packages/services        use cases: accounts, categories, transactions, attachments
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
bun run dev                   # http://localhost:3000, then open /setup
```

`packages/db/.env` may hold a separate `DATABASE_URL` for the Prisma CLI; the
root `.env` is canonical and is also the fallback for the CLI. `bun run dev`,
`start` and `worker` load the root `.env` explicitly (`bun --env-file=.env`),
so one file configures every local process.

Create the database once if you are not using Compose:

```bash
createdb -h localhost -U default cashow
```

Uploaded receipts go to `STORAGE_DIR` (default `./data/uploads`, resolved from
the web app's working directory). Point it at a persistent path outside the
repository for a real deployment; Compose uses `/app/data/uploads` on the shared
`files` volume.

### Useful commands

| Command                            | What it does                                                      |
| ---------------------------------- | ----------------------------------------------------------------- |
| `bun run dev`                      | Next.js dev server (Turbopack)                                    |
| `bun run build` / `bun run start`  | production build / serve                                          |
| `bun run worker`                   | run the background worker                                         |
| `bun run lint` / `bun run format`  | Biome check / rewrite                                             |
| `bun run typecheck`                | `tsc` for packages and the web app                                |
| `bun run test`                     | `bun test` (domain unit tests)                                    |
| `bun run test:ledger`              | Phase 1 gate: allocation rules enforced by the DB                 |
| `bun run test:chains`              | Phase 2 gate: payment plans, snapshots, reconciliation, transfers |
| `bun run test:summary`             | Phase 3 gate: summary totals, budgets, recurring templates        |
| `bun run smoke`                    | write/read a `BigInt` row through the typed client                |
| `bun run seed`                     | seed 100,000 transactions over three years                        |
| `bun run bench`                    | check the §8 read/write budgets on that seed                      |
| `bun run seed:clean`               | remove the benchmark owner, reopening `/setup`                    |
| `bun run test:e2e:auth`            | passkey E2E in Chrome (needs a DB with no users)                  |
| `bun run smoke:compat`             | Server Action / streaming / abort gates                           |
| `bun run db:migrate`               | apply pending migrations                                          |
| `bun run db:status`                | migration path and pending state                                  |
| `bun run db:verify`                | compare the live schema with the contract                         |
| `bun run db:plan -- --name <slug>` | plan a migration from contract changes                            |
| `bun run db:emit`                  | re-emit `contract.json` / `contract.d.ts`                         |

> `bun run typecheck` needs Next.js route types, which `bun run build` generates
> on a fresh checkout. Run the build once before typechecking `apps/web`.

### Signing in (passkeys)

There are no passwords and no public signup. On an empty database `/setup`
creates the owner and their first passkey; after that the page redirects to
`/login` and only registered passkeys can enter. `/app` lists the owner's
passkeys, lets them add another device, and refuses to revoke the last one.

- **Before the domain is final:** `WEB_ORIGIN` (and therefore the WebAuthn RP
  ID) defines where passkeys work. Do not create the real owner passkey on
  `localhost` or a temporary name — see [ADR 0006](docs/adr/0006-access-option.md).
- **Exposed before setup:** set `SETUP_TOKEN`; `/setup` then requires it.
  Remove the value once the owner exists.
- **Lost every passkey:** register a new one from the server with database
  access (delete the owner's `Passkey` rows, then run `/setup` again after
  deleting the user). There is no email recovery, by design.
- **How it works:** [ADR 0007](docs/adr/0007-passkey-auth.md).

```bash
# End-to-end passkey flow in headless Chrome with a virtual authenticator.
bun run test:e2e:auth          # CHROME_PATH overrides the browser binary
```

### The core ledger (Phase 1)

After setup, `/app` is the daily surface:

| Route                                 | What it does                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `/app`                                | Month summary, quick add, recent transactions, balances, top expenses         |
| `/app/transactions`                   | Filter, search, paginate; deleted rows are opt-in                             |
| `/app/transactions/new`               | Full form: type, amount, account, category, time, allocations                 |
| `/app/transactions/:id`               | Detail, attachments, soft delete/restore                                      |
| `/app/accounts`                       | Accounts, opening balances, snapshots and reconciliation (balance is derived) |
| `/app/categories`                     | One-level categories, separate income/expense trees                           |
| `/app/plans`                          | Payment plans: steps, derived status, partial payments, progress              |
| `/app/budgets`                        | Monthly budgets with usage and projection                                     |
| `/app/recurring`                      | Recurring transaction templates and due-run                                   |
| `/app/transactions/new?type=TRANSFER` | Transfer between two accounts with an optional fee                            |
| `/app/settings`                       | Profile, timezone, week/budget start, passkeys, audit, outbox                 |

Amounts are typed as text and parsed once: `35rb`, `1,5jt`, `Rp 35.000`. Money
stays a positive `bigint` in the database. An expense can draw from one or more
incomes; the database triggers enforce that allocations never exceed either the
expense or the income's free amount, that both sides belong to the same owner,
and that a deleted expense cannot keep live allocations.

Attachments are receipt photos, invoices and contracts. Images are downscaled
in the browser before upload; metadata is stored in Postgres and bytes on the
`STORAGE_DIR` volume. Serving is session-scoped (`/api/attachments/:id`) and
never public. See [ADR 0009](docs/adr/0009-attachment-storage.md).

### Performance seed and benchmark

```bash
bun run seed                   # 100k transactions, 20k allocations, ~10s
bun run bench                  # exits non-zero when a p95 misses its budget
bun run seed:clean             # remove it afterwards
```

The benchmark checks the plan §8 budgets at 100,000 transactions: dashboard
reads (balances, monthly cashflow, recent transactions, allocation outstanding)
p95 under 100 ms and transaction creation p95 under 150 ms. It also scans for
allocation sums that exceed either side, which would mean a trigger failed.
Nightly CI runs the same seed and benchmark.

### Framework compatibility gates

Two opt-in routes prove the Next.js-on-Bun behaviours from plan §6: a Server
Action driven by a plain HTML form post, and a streaming route with a
server-observed abort. They answer 404 unless `COMPAT_TOKEN` is set, so leave
it unset on a real deployment.

```bash
COMPAT_TOKEN=… bun run smoke:compat
SMOKE_BASE_URL=https://cashow.example.com COMPAT_TOKEN=… bun run smoke:compat
```

`SMOKE_BASE_URL` points at whatever should be tested — `bun run dev`, the
standalone server, or Compose behind Caddy.

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
  breaks every passkey and push subscription. Run `/setup` on the final name.
- **Setup:** with `SETUP_TOKEN` unset, `/setup` is open to anyone who reaches
  the app while it has no users. Set the token, complete setup, then remove it.
- **Secrets:** put them in `.env` for a small deployment, or use
  `<NAME>_FILE=/run/secrets/<name>` with Docker secrets/read-only mounts. Images
  contain no secrets.
- **Secrets to keep:** database password, VAPID private key, DeepSeek key,
  backup age key. Keep an offline copy; without the age key, encrypted backups
  are unreadable.

### Backups and restore

The `backup` service is opt-in so the base stack starts without a key:

```bash
mkdir -p secrets
age-keygen -o secrets/age.key          # keep the private key offline
# put the public key in BACKUP_AGE_RECIPIENT in .env
docker compose --profile backup up -d
```

It runs nightly at 02:15 UTC: `pg_dump` (custom format) **and** a tar of the
attachment directory (`STORAGE_DIR`, default `/files/uploads`) → `age`
encryption → `rclone` upload, with retention. Both artifacts are encrypted with
the same recipient and uploaded together; a database restore without the uploads
archive leaves every attachment row pointing at a missing blob.

`deploy/restore.sh` restores a dump into a throwaway database and checks that
the ledger tables exist. `deploy/restore-files.sh` restores the uploads archive
into a target directory and fails when it finds no files. Run both drill steps
monthly; a backup that was never restored is a hope, not a backup.

The backup target is an **external drive** (ADR 0006): set
`BACKUP_EXTERNAL_DIR` to the host mount, set `BACKUP_RCLONE_REMOTE` to a local
remote (for example `local:/external/cashow`), and make sure an unmounted drive
fails the job loudly instead of filling the container disk. The drive is mounted
read-write at `/external` inside the `backup` service. Keep an off-site copy if
the data matters beyond fire and theft.

```bash
STAMP=20261027T021500Z
docker compose --profile backup run --rm backup /usr/local/bin/restore.sh \
  "/backups/cashow-$STAMP.dump.age" cashow_drill
docker compose --profile backup run --rm backup /usr/local/bin/restore-files.sh \
  "/backups/cashow-$STAMP-files.tar.gz.age" /tmp/cashow_drill_uploads
```

The `files` volume (`/app/data` in `web`/`worker`) holds the attachment bytes.
Back it up or move it with the database; see
[ADR 0009](docs/adr/0009-attachment-storage.md).

### Health endpoints

- `GET /api/health` — liveness (process is up)
- `GET /api/ready` — readiness (Postgres reachable and schema queryable)

## Verification gates

CI runs, in order: frozen install, lint/format, production build, typecheck,
unit tests, migrations against an empty Postgres, `db verify`, the database
smoke test, the Phase 1 ledger gate (`test:ledger`: the Rp500.000/Rp250.000 flow plus database rejections for
over-allocation, wrong direction, cross-user references, category-kind mismatch
and restore-after-shrink), `test:chains` (a three-step plan with one partial
payment, derived progress, a backdated snapshot that recomputes later gaps,
checkpoint locking/unlocking, transfer fee cascades, ownership guards), the
framework compatibility gates (Server Action, streaming, abort), and a Docker
build of both runtime targets. A nightly job seeds 100,000 transactions and runs
the §8 performance budgets.

Local-only gates: `bun run test:e2e:auth` (Chrome with a virtual authenticator;
it now also drives the ledger smoke: defaults, quick add, the
Rp500.000/Rp250.000 allocation, an attachment upload/serve, a three-step plan
with a partial payment, and a transfer with a fee). The passkey gate in plan §6
additionally requires the real HTTPS domain, so run it once after the deployment
name is final.

## Decisions

Architecture decisions live in [docs/adr](docs/adr/). Authentication is recorded
in [ADR 0007](docs/adr/0007-passkey-auth.md), the compatibility probes in
[ADR 0008](docs/adr/0008-compat-probes.md), and attachment storage in
[ADR 0009](docs/adr/0009-attachment-storage.md). The open one is the access
option and permanent domain (ADR 0006); the backup target is settled as an
external drive.

## License

Private project. All rights reserved.
