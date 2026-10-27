# 0003 — Prisma 8 contract-first schema and migrations

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The plan requires a self-hosted PostgreSQL database with DB-enforced invariants:
positive amounts, transfer accounts differ, allocation sums never exceed either
side, and one snapshot per account and instant. The project uses the current
Prisma generation, where the data contract is authored in PSL and emitted to a
typed `contract.json` rather than generated into `node_modules`.

## Decision

- Author the canonical schema in `packages/db/src/prisma/contract.prisma`.
- Emit with `prisma contract emit`; commit the emitted `contract.json`,
  `contract.d.ts` and the `migrations/` packages so a clean checkout and the
  Docker image can run without regeneration.
- Create migrations with `prisma migration plan` (schema changes) or
  `prisma migration new --from <hash>` (manual, data/trigger changes), then
  apply with `prisma db migrate`.
- Encode single-row invariants as `@@check` expressions. Cross-row invariants
  (allocation sums) are installed as PL/pgSQL triggers inside the baseline
  migration, because a CHECK cannot read other rows.
- Money is 64-bit integer rupiah (`BigInt` → `pg/int8`). Instants are
  `timestamptz`; calendar dates are `DateString`. Never store derived balances.
- Soft delete is a nullable `deletedAt` with explicit filtering; Prisma 8 has no
  built-in soft delete.

## Consequences

- The schema is reviewable as one PSL file, and emitted artifacts are
  reproducible.
- `db init` is a convenience for a fresh development database. Deployments use
  the migration path (`db migrate`), which the CI proves against an empty
  database.
- Hand-editing a migration requires re-running it with Node to re-emit
  `ops.json` and re-attest the package; `prisma migration check` must pass.
- Prisma CLI and runtime packages are versioned independently
  (`8.0.0-rc.27` vs `8.0.0-rc.20`); pin both exactly and upgrade together.
