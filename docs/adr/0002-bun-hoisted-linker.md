# 0002 — Bun `hoisted` linker for workspace resolution

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Bun 1.4 can install with an isolated layout (`node_modules/.bun/...` links per
workspace) or a hoisted layout. Next.js/Turbopack and `tsc` resolve
`@cashow/*` imports through `node_modules`; with the isolated linker, workspace
packages were not reachable from the apps and stale per-workspace
`node_modules` directories made `bun run worker` fail with `ENOENT reading
packages/config/node_modules/zod`.

## Decision

Pin the hoisted linker in `bunfig.toml`:

```toml
[install]
linker = "hoisted"
```

After switching linkers, remove any per-workspace `node_modules` directories
once and reinstall. Do not run `bun install --linker isolated` for this repo.

## Consequences

- Workspace symlinks live at the root `node_modules`, which Next.js, `tsc` and
  Bun all resolve.
- The install script allow-list stays explicit (`trustedDependencies`); install
  scripts must be reviewed before adding a package that needs one.
- `bun.lock` is the only lockfile; CI and Docker use `--frozen-lockfile`.
