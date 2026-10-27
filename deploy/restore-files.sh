#!/bin/sh
# Restore attachment bytes archived by deploy/backup.sh.
#
#   restore-files.sh <files.tar.gz|files.tar.gz.age> <target-directory> [--force]
#
# A database restore without this leaves every attachment row pointing at a
# missing blob. Restore into the live uploads directory only with --force.
set -eu

SOURCE="${1:?usage: restore-files.sh <files.tar.gz|files.tar.gz.age> <target-directory> [--force]}"
TARGET="${2:?usage: restore-files.sh <files.tar.gz|files.tar.gz.age> <target-directory> [--force]}"
FORCE="${3:-}"
LIVE_DIR="${STORAGE_DIR:-/app/data/uploads}"

if [ "$TARGET" = "$LIVE_DIR" ] && [ "$FORCE" != "--force" ]; then
  echo "refusing to restore over the live uploads directory '$TARGET' without --force" >&2
  exit 1
fi

DECRYPTED=""
trap 'if [ -n "$DECRYPTED" ]; then rm -f "$DECRYPTED"; fi' EXIT

ARCHIVE="$SOURCE"
if [ "${SOURCE##*.}" = "age" ]; then
  KEY="${BACKUP_AGE_KEY:-/secrets/age.key}"
  [ -f "$KEY" ] || {
    echo "age key not found at $KEY" >&2
    exit 1
  }
  DECRYPTED="$(mktemp)"
  age --decrypt --identity "$KEY" --output "$DECRYPTED" "$SOURCE"
  ARCHIVE="$DECRYPTED"
fi

# Fail on a corrupt archive before writing anything into the target.
tar -tzf "$ARCHIVE" >/dev/null

mkdir -p "$TARGET"
echo "restoring $SOURCE -> $TARGET"
tar -xzf "$ARCHIVE" -C "$TARGET"

COUNT="$(find "$TARGET" -type f | wc -l | tr -d ' ')"
if [ "$COUNT" -eq 0 ]; then
  echo "note: archive contains no files (the ledger had no attachments)"
fi

echo "restore ok: $TARGET ($COUNT files)"
