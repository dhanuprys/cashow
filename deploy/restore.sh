#!/bin/sh
# Restore a Cashow dump into a database.
#
#   restore.sh <dump|dump.age> <target-database>
#
# The monthly drill restores into a throwaway database. Never point this at the
# live database unless you passed --force.
set -eu

SOURCE="${1:?usage: restore.sh <dump|dump.age> <target-database> [--force]}"
TARGET="${2:?usage: restore.sh <dump|dump.age> <target-database> [--force]}"
FORCE="${3:-}"

if [ "$TARGET" = "$PGDATABASE" ] && [ "$FORCE" != "--force" ]; then
  echo "refusing to restore over the live database '$TARGET' without --force" >&2
  exit 1
fi

PLAIN="$SOURCE"
if [ "${SOURCE##*.}" = "age" ]; then
  KEY="${BACKUP_AGE_KEY:-/secrets/age.key}"
  [ -f "$KEY" ] || {
    echo "age key not found at $KEY" >&2
    exit 1
  }
  PLAIN="$(mktemp)"
  age --decrypt --identity "$KEY" --output "$PLAIN" "$SOURCE"
fi

echo "restoring $SOURCE -> $TARGET"
createdb "$TARGET" 2>/dev/null || true
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET" "$PLAIN"

# Integrity smoke: the schema must contain the ledger tables.
COUNT="$(psql --dbname "$TARGET" --tuples-only --no-align \
  --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User','Account','Transaction','Allocation','BalanceSnapshot');")"
if [ "$COUNT" -lt 5 ]; then
  echo "restore verification failed: only $COUNT/5 ledger tables present" >&2
  exit 1
fi

echo "restore ok: $TARGET ($COUNT ledger tables)"
