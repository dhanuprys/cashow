# Roll back a release

Use this when a deploy broke something and the fastest safe path is the previous
image. The database is the constraint: migrations are expand-then-contract, so a
rollback is only safe across an expand-only release.

## Before you roll back

1. Check what changed in the database. A migration that dropped or renamed a
   column is **not** rollback-safe:

   ```bash
   git log --oneline <last-good>..<current>
   ls packages/db/migrations/app | tail -5
   ```

2. If the release only added tables/columns/enums, continue. If it removed
   anything, restore the pre-release backup instead (see
   `restore-from-bare-server.md`), because the old code cannot read the new
   shape.

## Steps

1. Pin the previous images in `.env`:

   ```bash
   # previous good release tags
   CASHOW_WEB_IMAGE=<registry>/cashow:0.2.0-web
   CASHOW_WORKER_IMAGE=<registry>/cashow:0.2.0-worker
   ```

2. Recreate only the app containers (not Postgres):

   ```bash
   docker compose up -d --no-deps --force-recreate web worker
   ```

3. Do **not** run `migrate` down. The schema stays forward. Old code tolerates
   additive columns; it must never see a missing one.

4. If the worker wrote rows the old code cannot parse, stop it first, roll back
   `web`, then start the worker:

   ```bash
   docker compose stop worker
   docker compose up -d --no-deps --force-recreate web
   docker compose up -d worker
   ```

## How you know it worked

- `docker compose ps` shows the previous image tags.
- The failing flow works again in the browser.
- `bun run db:verify` still passes (the contract marker is unchanged by a
  code-only rollback).
- `docker compose logs --tail=50 web worker` has no new errors.

## After

- Write down which migration is now "newer than the running code" so the next
  forward deploy knows it is already applied.
- If the bad release shipped a data migration, check the affected rows; a
  code-only rollback does not undo them.
