#!/bin/sh
# Monthly restore drill: restore the newest backup into a THROWAWAY database.
#
# This never touches the live database. It decrypts (if needed), restores into
# a scratch database named after the drill, runs the 9-table integrity check,
# compares row counts against the live database, then drops the scratch copy.
# The result is written to `last-drill.json` next to the backups so a
# freshness rule or a human can see when recovery was last proven.
#
# Required:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE (the live database, read-only use)
# Optional:
#   BACKUP_DIR             where artifacts live (default /backups)
#   BACKUP_AGE_KEY         age identity for decryption (default /secrets/age.key)
#   DRILL_DB               scratch database name (default cashow_drill)
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DRILL_DB="${DRILL_DB:-cashow_drill}"
STATUS="$BACKUP_DIR/last-drill.json"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

fail() {
  printf '%s\n' "{\"ok\":false,\"at\":\"$STAMP\",\"error\":\"$1\"}" >"$STATUS"
  echo "drill failed: $1" >&2
  exit 1
}

# Pick the newest dump (plain or .age).
DUMP="$(ls -1t "$BACKUP_DIR"/cashow-*.dump "$BACKUP_DIR"/cashow-*.dump.age 2>/dev/null | head -1 || true)"
[ -n "$DUMP" ] || fail "no dump found in $BACKUP_DIR"

if [ "$DRILL_DB" = "$PGDATABASE" ]; then
  fail "DRILL_DB must differ from the live database ($PGDATABASE)"
fi

# Decrypt to a temp file when the artifact is age-encrypted.
PLAIN="$DUMP"
TMP_PLAIN=""
if [ "${DUMP##*.}" = "age" ]; then
  KEY="${BACKUP_AGE_KEY:-/secrets/age.key}"
  [ -f "$KEY" ] || fail "age key not found at $KEY"
  TMP_PLAIN="$(mktemp)"
  age --decrypt --identity "$KEY" --output "$TMP_PLAIN" "$DUMP" || fail "age decrypt"
  PLAIN="$TMP_PLAIN"
fi

cleanup() {
  psql --dbname postgres --command "DROP DATABASE IF EXISTS \"$DRILL_DB\"" >/dev/null 2>&1 || true
  if [ -n "$TMP_PLAIN" ]; then rm -f "$TMP_PLAIN"; fi
}
trap cleanup EXIT

psql --dbname postgres --command "DROP DATABASE IF EXISTS \"$DRILL_DB\"" >/dev/null 2>&1 || true
createdb "$DRILL_DB" || fail "createdb $DRILL_DB"
pg_restore --no-owner --no-privileges --dbname "$DRILL_DB" "$PLAIN" || fail "pg_restore"

TABLES="$(psql --dbname "$DRILL_DB" --tuples-only --no-align --command \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User','Account','Category','Transaction','Allocation','Attachment','BalanceSnapshot','OutboxEvent','AuditLog');")"
[ "$TABLES" -ge 9 ] || fail "only $TABLES/9 ledger tables restored"

LIVE_TX="$(psql --dbname "$PGDATABASE" --tuples-only --no-align --command 'SELECT count(*) FROM "Transaction";' 2>/dev/null || echo 0)"
DRILL_TX="$(psql --dbname "$DRILL_DB" --tuples-only --no-align --command 'SELECT count(*) FROM "Transaction";')"
if [ "$LIVE_TX" -gt 0 ] && [ "$DRILL_TX" -eq 0 ]; then
  fail "restored database has no transactions while live has $LIVE_TX"
fi

printf '%s\n' "{\"ok\":true,\"at\":\"$STAMP\",\"dump\":\"$(basename "$DUMP")\",\"tables\":$TABLES,\"transactions\":$DRILL_TX,\"liveTransactions\":$LIVE_TX}" >"$STATUS"
echo "drill ok: $DRILL_DB restored from $(basename "$DUMP") ($TABLES tables, $DRILL_TX transactions)"
