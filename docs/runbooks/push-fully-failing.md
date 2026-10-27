# Push fully failing

No notification reaches any device. Work from the outside in: worker → sender →
endpoint → device.

## 1. Is the worker running and claiming?

```bash
docker compose ps worker
docker compose logs --tail=100 worker
```

Look for `claim`/`outbox` errors. The worker claims `PENDING` outbox rows with
`FOR UPDATE SKIP LOCKED`, evaluates rules, then calls
`deliverPendingNotifications`.

## 2. Are deliveries being attempted?

```sql
SELECT status, count(*) FROM "NotificationDelivery" GROUP BY status;
SELECT count(*) FROM "NotificationDelivery" WHERE status = 'PENDING';
```

- A growing `PENDING` backlog with a running worker means delivery is failing
  before the send (claim or query error) — check worker logs.
- `FAILED` rows with `attempts >= 3` mean the sender returned an error every
  time. Inspect `lastError`:

  ```sql
  SELECT "channelEndpointId", attempts, "lastError", "updatedAt"
  FROM "NotificationDelivery" WHERE status = 'FAILED' ORDER BY "updatedAt" DESC LIMIT 10;
  ```

## 3. Are endpoints active?

```sql
SELECT kind, active, count(*) FROM "ChannelEndpoint" GROUP BY kind, active;
```

A 404/410 from the push service deactivates the endpoint by design. If every
endpoint is `active = false`, devices must re-subscribe.

## 4. Is VAPID configured and unchanged?

```bash
grep -E 'VAPID_(PUBLIC|PRIVATE|SUBJECT)' .env
```

- Missing key → the worker logs a sender error and no push leaves the host.
- **Rotated key** → every old subscription is invalid; endpoints will fail with
  401/403 and be marked `FAILED`. Rotate deliberately; see
  `rotate-secrets-and-backup-key.md`.
- `VAPID_SUBJECT` must be a `mailto:` or `https:` URL.

## 5. Network egress

The push service is on the public internet; the worker must be able to reach
it. The `backend` network has outbound access by default. Check from the host:

```bash
docker compose exec worker sh -c 'wget -qO- https://fcm.googleapis.com/ >/dev/null && echo egress-ok'
```

## 6. Re-subscribe a device

If endpoints are dead, open `/app/settings` on the device, subscribe again, then
trigger a rule (or use "Jalankan aturan" on `/app/rules`) and confirm a
notification arrives.

## How you know it worked

- New rows in `NotificationDelivery` go `PENDING` → `SENT`.
- `sent`/`failed` counters in the worker log are non-zero and the latest batch
  has no errors.
- A test notification arrives on the phone.

## Notes

- Delivery caps at 3 attempts per delivery; a permanently failing endpoint is
  deactivated rather than retried forever.
- Nothing else depends on push: in-app notifications still appear in
  `/app/inbox` even when delivery fails.