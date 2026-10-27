# Restore from a bare server

Use this when the host is lost, the disk failed, or you are rebuilding from
scratch. You need: the repo, `.env`, `secrets/age.key`, and a copy of
`BACKUP_DIR`.

## What you need before starting

- A new host with Docker and Compose installed.
- The current `.env` (or the values to recreate it).
- `secrets/age.key` — **without this the encrypted backups are unreadable.**
- The backup directory (default `./backups`), copied onto the new host.
- The domain you will serve on. Passkeys and push subscriptions are bound to
  it; using a different origin invalidates them (see ADR 0006).

## Steps

1. Clone the repo and create the directories:

   ```bash
   git clone <repo> cashow && cd cashow
   mkdir -p secrets backups
   cp /path/to/age.key secrets/age.key
   cp /path/to/.env .env
   cp -a /path/to/backups/. backups/
   ```

2. Start Postgres only, and let it initialize empty:

   ```bash
   docker compose up -d postgres
   docker compose ps postgres   # wait for "healthy"
   ```

3. Restore the newest dump into the live database. This is the one place we
   write over `cashow`, so `--force` is required and intended:

   ```bash
   LATEST=$(ls -1t backups/cashow-*.dump.age backups/cashow-*.dump 2>/dev/null | head -1)
   docker compose --profile backup run --rm backup \
     /usr/local/bin/restore.sh "/backups/$(basename "$LATEST")" cashow --force
   ```

   Expected tail: `restore ok: cashow (9 ledger tables)`.

4. Restore the attachment bytes into the shared `files` volume:

   ```bash
   FILES=$(ls -1t backups/cashow-*-files.tar.gz.age backups/cashow-*-files.tar.gz 2>/dev/null | head -1)
   docker compose --profile backup run --rm \
     -v cashow_files:/restore-target backup \
     /usr/local/bin/restore-files.sh "/backups/$(basename "$FILES")" /restore-target/uploads --force
   ```

   The target path must be what the app uses for `STORAGE_DIR` inside the
   volume (`/app/data/uploads` is the container path for the same volume; use
   `/restore-target/uploads` when restoring into a fresh mount and then move
   the files, or restore directly to `/files/uploads` if you mount it).

5. Bring up the rest of the stack:

   ```bash
   docker compose up -d --build
   docker compose run --rm migrate
   ```

6. Verify:

   ```bash
   bun run db:verify
   curl -fsS http://localhost/api/health   # or your domain
   ```

## How you know it worked

- `restore ok` with **9 ledger tables**.
- The app loads and your transactions are there.
- An attachment you know existed opens from the transaction detail page.
- `backups/last-drill.json` from the previous host shows a recent successful
  drill; run the drill again on the new host (see `README.md`).

## If it goes wrong

- **`age key not found`** — `secrets/age.key` is missing or not readable; fix
  the mount before retrying.
- **`refusing to restore over the live database`** — you are restoring into
  `$PGDATABASE` without `--force`; that guard is deliberate.
- **`only N/9 ledger tables present`** — the dump is truncated or from a much
  older schema. Try the previous artifact.
- **Passkeys stop working** — the origin changed. Reset the owner passkey on
  the new origin (see ADR 0007) rather than restoring old credentials.
