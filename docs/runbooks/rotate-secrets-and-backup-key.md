# Rotate secrets and the backup key

Rotate on a schedule, after a leak, or when a device that held a secret is lost.

## Inventory

| Secret | Where | Rotating invalidates |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `.env` / Docker secret | nothing, but update `DATABASE_URL` too |
| VAPID private key | `.env` (`VAPID_PRIVATE_KEY`) | every push subscription |
| `DEEPSEEK_API_KEY` | `.env` | nothing |
| `BACKUP_AGE_RECIPIENT` / `secrets/age.key` | `.env` + offline file | nothing (new backups only) |
| `SETUP_TOKEN` | `.env` | nothing |

## Rotate a database password

1. Change it in Postgres first:

   ```bash
   docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
     -U "$POSTGRES_USER" -d postgres \
     -c "ALTER ROLE \"$POSTGRES_USER\" WITH PASSWORD '<new>';"
   ```

2. Update `POSTGRES_PASSWORD` (and `DATABASE_URL` if you set it by hand) in
   `.env`.

3. Recreate the consumers:

   ```bash
   docker compose up -d --force-recreate web worker migrate
   ```

## Rotate the VAPID key pair

1. Generate a new pair:

   ```bash
   bunx web-push generate-vapid-keys
   ```

2. Put the new `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in
   `.env`.

3. **Every existing subscription becomes invalid.** Clear them so the app
   re-subscribes cleanly:

   ```sql
   UPDATE "ChannelEndpoint" SET "active" = false, "updatedAt" = now()
   WHERE "kind" = 'PUSH';
   ```

4. Recreate `web` and `worker`. Re-subscribe each device from
   `/app/settings`.

## Rotate the backup age key

This is the risky one: old backups are only readable with the **old** key.

1. Generate a new identity **offline**:

   ```bash
   age-keygen -o age.key.new   # keep this file offline
   age-keygen -y age.key.new   # prints the new age1... recipient
   ```

2. Put the new recipient in `.env` as `BACKUP_AGE_RECIPIENT`.

3. Keep `secrets/age.key` (the old identity) until every pre-rotation backup
   has expired by `BACKUP_RETENTION_DAYS`. Label it clearly, e.g.
   `secrets/age.key.2026-10-old`.

4. Recreate `backup` so the next run encrypts with the new recipient:

   ```bash
   docker compose --profile backup up -d --force-recreate backup
   ```

5. After the first new backup, confirm it decrypts with the **new** key and
   run the drill.

6. Only when no backup encrypted under the old key remains, delete the old
   identity from the host and from every offline copy.

## How you know it worked

- `docker compose logs --tail=50 web worker` shows no auth/database errors.
- A test notification arrives on a re-subscribed device.
- `backups/last-run.json` has `"ok":true` after the rotation.
- `backups/last-drill.json` has `"ok":true` and a timestamp after the rotation.

## After

- Record the rotation date next to the key inventory.
- If a leak is suspected, also revoke sessions and push endpoints
  (`lost-or-stolen-phone.md`).