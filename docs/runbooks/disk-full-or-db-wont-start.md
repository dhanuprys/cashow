# Disk full or database not starting

These two tend to arrive together: Postgres refuses to start when its WAL
cannot be written.

## A. Disk full

1. Find what filled the disk:

   ```bash
   df -h /
   du -xh --max-depth=2 / 2>/dev/null | sort -h | tail -20
   ```

2. Common culprits on this host:

   | Path | What | Safe to remove |
   | --- | --- | --- |
   | `/var/lib/docker/containers/*/*.log` | container logs | truncate, not delete |
   | `backups/` | old artifacts | anything past `BACKUP_RETENTION_DAYS`, after a drill |
   | Postgres WAL in `pgdata` | uncheckpointed WAL | **never** delete by hand |
   | `/var/lib/docker/overlay2` | dangling images/volumes | `docker image prune`, `docker volume prune` (verify names first) |

3. Truncate runaway container logs safely:

   ```bash
   for f in /var/lib/docker/containers/*/*-json.log; do : > "$f"; done
   ```

4. Prune unused Docker data (read the prompt; this never touches named volumes
   unless you pass `--volumes`):

   ```bash
   docker image prune -f
   docker builder prune -f
   ```

5. Confirm headroom before restarting anything:

   ```bash
   df -h /
   ```

## B. Database will not start

1. Read the real error — Compose truncates it:

   ```bash
   docker compose logs --tail=200 postgres
   docker logs postgres17 2>&1 | tail -50
   ```

2. Match the message:

   | Message | Cause | Fix |
   | --- | --- | --- |
   | `could not write to file ... No space left on device` | disk full | do A first |
   | `database files are incompatible with server` | major version mismatch | see `postgres-major-upgrade.md` |
   | `PANIC: could not locate a valid checkpoint record` | corrupted WAL | restore from backup |
   | `FATAL: the database system is starting up` | normal warm-up | wait, then re-check |
   | `permission denied` on `pgdata` | volume ownership changed | fix ownership to the `postgres` uid |

3. If the data directory is corrupt, do **not** try to repair it in place.
   Restore into a fresh database using `restore-from-bare-server.md` steps 2–4.

4. After it starts, verify integrity:

   ```bash
   docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c 'SELECT count(*) FROM "Transaction";'
   bun run db:verify
   ```

## How you know it worked

- `docker compose ps postgres` is `healthy`.
- `df -h /` shows free space above your headroom target.
- `db:verify` passes and the app loads.
- A fresh backup runs: `backups/last-run.json` has `"ok":true`.

## Prevention

- Keep `BACKUP_DIR` on a disk with space to spare; a full backup disk fails
  silently-looking but loudly-logged.
- Set Docker log rotation:

  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
  ```