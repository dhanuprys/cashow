#!/bin/sh
# Nightly database backup: pg_dump (custom format) -> age encryption -> rclone.
#
# Required:
#   BACKUP_AGE_RECIPIENT   age public key (age1...)
# Optional:
#   BACKUP_RCLONE_REMOTE   rclone target, e.g. "b2:cashow-backups"
#   BACKUP_DIR             local staging directory (default /backups)
#   BACKUP_RETENTION_DAYS  local/remote retention (default 30)
#   BACKUP_ALLOW_UNENCRYPTED=1  explicit opt-out for local-only drills
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/cashow-$STAMP.dump"
STATUS="$BACKUP_DIR/last-run.json"

mkdir -p "$BACKUP_DIR"

fail() {
  printf '%s\n' "{\"ok\":false,\"at\":\"$STAMP\",\"error\":\"$1\"}" >"$STATUS"
  echo "backup failed: $1" >&2
  exit 1
}

echo "pg_dump $PGDATABASE -> $DUMP"
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$DUMP" \
  || fail "pg_dump"

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "encrypting with age"
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$DUMP.age" "$DUMP" \
    || fail "age encrypt"
  rm -f "$DUMP"
  ARTIFACT="$DUMP.age"
elif [ "${BACKUP_ALLOW_UNENCRYPTED:-0}" = "1" ]; then
  echo "WARNING: BACKUP_ALLOW_UNENCRYPTED=1, keeping plaintext" >&2
  ARTIFACT="$DUMP"
else
  rm -f "$DUMP"
  fail "BACKUP_AGE_RECIPIENT is not set"
fi

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "uploading to $BACKUP_RCLONE_REMOTE"
  rclone copy "$ARTIFACT" "$BACKUP_RCLONE_REMOTE" || fail "rclone upload"
  rclone delete --min-age "${RETENTION_DAYS}d" "$BACKUP_RCLONE_REMOTE" || fail "rclone prune"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'cashow-*.dump*' -mtime "+$RETENTION_DAYS" -delete

SIZE="$(wc -c <"$ARTIFACT" | tr -d ' ')"
printf '%s\n' "{\"ok\":true,\"at\":\"$STAMP\",\"file\":\"$(basename "$ARTIFACT")\",\"bytes\":$SIZE,\"uploaded\":$([ -n "${BACKUP_RCLONE_REMOTE:-}" ] && echo true || echo false)}" >"$STATUS"
echo "backup ok: $ARTIFACT ($SIZE bytes)"
