# Lost or stolen phone

A missing device is a credential incident: it may still hold an active session
and a push subscription. Revoke both.

## What the device can do

- It has a **session cookie** — a random token whose hash is stored in the
  `Session` table. Revoking the row kills it immediately.
- It may have a **passkey** registered to your account. A passkey alone cannot
  sign in without the device, but the device can use it.
- It has a **push subscription** (`ChannelEndpoint`). Leaving it active sends
  notifications to a device you no longer control.

## Steps

1. From a device you still control, sign in to `/app/settings`.

2. Revoke every session except the current one. Sessions are hashed at rest, so
   revocation means deleting the rows:

   ```bash
   docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql \
     -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c "DELETE FROM \"Session\" WHERE \"userId\" = '<owner-user-id>';"
   ```

   This signs the lost phone out on its next request.

3. Deactivate the push endpoints for that user. Prefer the app
   (`/app/settings` → per-endpoint deactivate). Equivalent SQL:

   ```sql
   UPDATE "ChannelEndpoint" SET "active" = false, "updatedAt" = now()
   WHERE "userId" = '<owner-user-id>' AND "kind" = 'PUSH';
   ```

4. Remove the passkey that lived on the lost device. Because the owner account
   is the only user, the clean path is to clear the passkey rows and re-run
   `/setup` on a trusted device:

   ```sql
   DELETE FROM "Passkey" WHERE "userId" = '<owner-user-id>';
   ```

   Keep any passkey you registered on a _different_ device if you know its
   credential id; otherwise remove all and re-enrol.

5. Re-enrol a new passkey from a trusted device at `/setup` (or `/app/settings`
   if the account still has one passkey).

## How you know it worked

- The lost device gets a 401 / redirect to sign-in on its next request.
- `SELECT count(*) FROM "Session" WHERE "userId" = '<id>';` is 0 (or 1, your
  current session).
- `SELECT count(*) FROM "ChannelEndpoint" WHERE "userId" = '<id>' AND "active";`
  is 0.
- A notification created afterwards reaches only your new device.

## After

- Change the password of the email account that owns the VAPID/DeepSeek keys
  if the phone had access to any of them.
- If the device held `secrets/age.key`, rotate it — see
  `rotate-secrets-and-backup-key.md`.
