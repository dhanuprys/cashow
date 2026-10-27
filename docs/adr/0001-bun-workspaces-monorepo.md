# 0001 — Bun workspaces monorepo with `@cashow/*` packages

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Cashow has three runtimes that share domain rules but must not share accidental
coupling: the Next.js web app, the background worker, and the database client.
The plan places pure math in `domain`, boot-time validation in `config`, and
storage in `db`, and requires a worker that reuses the same code.

## Decision

Use a Bun workspaces monorepo:

```
apps/web        Next.js 16 (App Router, standalone output)
apps/worker     background jobs
packages/domain pure TypeScript: money, dates, allocations, formatters
packages/config Zod environment schema and loaders
packages/db     Prisma 8 contract, client, migrations
packages/services use cases (transactions, allocation, reconciliation)
packages/notify notification channels
packages/ai     DeepSeek / Vercel AI SDK integration
```

Workspace packages export TypeScript source directly (`"exports": "./src/index.ts"`).
Bun, Turbopack and the worker all execute TS, so no build step is needed for
internal packages. Dependencies point downward only: `apps → services → db →
config/domain`; `domain` has no runtime dependencies.

## Consequences

- One lockfile, one install, one version of each dependency.
- Next.js traces workspace sources into the standalone image; no
  `transpilePackages` entry is required because Turbopack compiles TS from
  workspaces by default.
- A package that is imported by the web app must remain server-safe unless it is
  explicitly marked client-only. Secrets stay in `config`/`db`, never in
  `domain`.
