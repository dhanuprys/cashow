#!/bin/sh
# Nightly backup: database dump + attachment bytes -> age encryption -> rclone.
#
# A backup that leaves out `STORAGE_DIR` restores an empty ledger of receipts
# (ADR 0009), so the two artifacts are always produced together.
#
# Required:
#   BACKUP_AGE_RECIPIENT   age public key (age1...)
# Optional:
#   BACKUP_RCLONE_REMOTE   rclone target, e.g. "b2:cashow-backups"
#   BACKUP_DIR             local staging directory (default /backups)
#   STORAGE_DIR            attachment directory (default /files/uploads)
#   BACKUP_RETENTION_DAYS  local/remote retention (default 30)
#   BACKUP_ALLOW_UNENCRYPTED=1  explicit opt-out for local-only drills
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
STORAGE_DIR="${STORAGE_DIR:-/files/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/cashow-$STAMP.dump"
FILES="$BACKUP_DIR/cashow-$STAMP-files.tar.gz"
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

# The uploads directory is created on first upload; an empty stack has none.
if [ -d "$STORAGE_DIR" ]; then
  echo "archiving $STORAGE_DIR -> $FILES"
  tar -czf "$FILES" -C "$STORAGE_DIR" . || fail "tar uploads"
else
  echo "WARNING: $STORAGE_DIR does not exist; archiving an empty uploads tree" >&2
  EMPTY_DIR="$(mktemp -d)"
  tar -czf "$FILES" -C "$EMPTY_DIR" . || fail "tar empty uploads"
  rmdir "$EMPTY_DIR"
fi

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "encrypting with age"
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$DUMP.age" "$DUMP" \
    || fail "age encrypt dump"
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$FILES.age" "$FILES" \
    || fail "age encrypt uploads"
  rm -f "$DUMP" "$FILES"
  DB_ARTIFACT="$DUMP.age"
  FILES_ARTIFACT="$FILES.age"
elif [ "${BACKUP_ALLOW_UNENCRYPTED:-0}" = "1" ]; then
  echo "WARNING: BACKUP_ALLOW_UNENCRYPTED=1, keeping both artifacts plaintext" >&2
  DB_ARTIFACT="$DUMP"
  FILES_ARTIFACT="$FILES"
else
  rm -f "$DUMP" "$FILES"
  fail "BACKUP_AGE_RECIPIENT is not set"
fi

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  echo "uploading to $BACKUP_RCLONE_REMOTE"
  rclone copy "$DB_ARTIFACT" "$BACKUP_RCLONE_REMOTE" || fail "rclone upload dump"
  rclone copy "$FILES_ARTIFACT" "$BACKUP_RCLONE_REMOTE" || fail "rclone upload uploads"
  rclone delete --min-age "${RETENTION_DAYS}d" "$BACKUP_RCLONE_REMOTE" || fail "rclone prune"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'cashow-*.dump*' -o -name 'cashow-*-files.tar.gz*' \) \
  -mtime "+$RETENTION_DAYS" -delete

DB_SIZE="$(wc -c <"$DB_ARTIFACT" | tr -d ' ')"
FILES_SIZE="$(wc -c <"$FILES_ARTIFACT" | tr -d ' ')"
printf '%s\n' "{\"ok\":true,\"at\":\"$STAMP\",\"dump\":\"$(basename "$DB_ARTIFACT")\",\"dumpBytes\":$DB_SIZE,\"files\":\"$(basename "$FILES_ARTIFACT")\",\"filesBytes\":$FILES_SIZE,\"uploaded\":$([ -n "${BACKUP_RCLONE_REMOTE:-}" ] && echo true || echo false)}" >"$STATUS"
echo "backup ok: $DB_ARTIFACT ($DB_SIZE bytes) + $FILES_ARTIFACT ($FILES_SIZE bytes)"
