# Upgrade the Postgres major version

A major upgrade (e.g. `pg17` → `pg18`) cannot reuse the data directory. The
safe path is dump → new cluster → restore.

## Before you start

- Take a fresh backup and prove it:

  ```bash
  docker compose --profile backup run --rm backup /usr/local/bin/backup.sh
  docker compose --profile backup run --rm backup /usr/local/bin/restore-drill.sh
  ```

  Both `last-run.json` and `last-drill.json` must say `"ok":true`.
- Note the current image tag in `docker-compose.yml`.

## Steps

1. Stop the app, keep the old Postgres volume untouched:

   ```bash
   docker compose down
   ```

2. Start the **new** Postgres with a fresh, empty volume name (do not point it
   at `pgdata`):

   ```bash
   # edit docker-compose.yml: image: pgvector/pgvector:pg18
   # and add a temporary volume name, e.g. pgdata_new
   docker compose up -d postgres
   ```

3. Restore the latest dump into the new, empty cluster:

   ```bash
   LATEST=$(ls -1t backups/cashow-*.dump.age backups/cashow-*.dump 2>/dev/null | head -1)
   docker compose --profile backup run --rm backup \
     /usr/local/bin/restore.sh "/backups/$(basename "$LATEST")" cashow --force
   ```

4. Point the stack at the new volume. In `docker-compose.yml` set `pgdata` to
   the new volume (or rename `pgdata_new` → `pgdata` after removing the old
   one), then:

   ```bash
   docker compose up -d
   docker compose run --rm migrate   # applies any contract changes
   ```

5. Verify:

   ```bash
   bun run db:verify
   docker compose logs --tail=50 postgres | grep -i error || true
   ```

## How you know it worked

- `db:verify` says the marker and schema match.
- Row counts match the pre-upgrade counts.
- `SELECT version();` reports the new major.
- The app reads and writes transactions.

## Rolling back

Keep the old `pgdata` volume until you are satisfied. To go back, stop the
stack, restore the old volume name in `docker-compose.yml`, and start again.
The old volume is only valid with the old image tag.

## Notes

- Extensions must exist for the new major. This stack needs `pgvector` (pinned
  image) and the `citext`/`pgcrypto` extensions if used by the contract; check
  `CREATE EXTENSION` in the migrations before switching.
- Never run two Postgres majors against the same volume.
