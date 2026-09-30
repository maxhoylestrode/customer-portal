#!/bin/sh
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env

# Prisma's ?schema= parameter isn't understood by libpq
DB_URL=$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')
FILE="apex-portal-$(date +%Y-%m-%dT%H-%M-%S).dump"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

ping() {
  if [ -n "${BACKUP_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 3 "${BACKUP_PING_URL}$1" > /dev/null || echo "[backup] warning: could not reach ping URL"
  fi
}
fail() {
  echo "[backup] FAILED: $1" >&2
  ping /fail
  exit 1
}

[ -n "${BACKUP_PASSPHRASE:-}" ] || fail "BACKUP_PASSPHRASE is not set; refusing to create an unencrypted backup"

echo "[backup] $(date '+%F %T') dumping database..."
pg_dump -Fc -d "$DB_URL" -f "$WORK/$FILE" || fail "pg_dump could not dump the database"
pg_restore --list "$WORK/$FILE" > /dev/null || fail "the dump file is unreadable"

printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --passphrase-fd 0 --pinentry-mode loopback \
  --symmetric --cipher-algo AES256 -o "$WORK/$FILE.gpg" "$WORK/$FILE" || fail "encryption failed"
rm "$WORK/$FILE"
FILE="$FILE.gpg"

SIZE=$(du -h "$WORK/$FILE" | cut -f1)
rclone copyto "$WORK/$FILE" "$BACKUP_REMOTE/$FILE" || fail "upload to $BACKUP_REMOTE failed"

# Pruning only happens after a successful upload, so a broken backup job can
# never delete the last good copies.
rclone delete "$BACKUP_REMOTE" --min-age "${BACKUP_KEEP_DAYS}d" --include "apex-portal-*" \
  || echo "[backup] warning: pruning old backups failed"

echo "[backup] OK: $FILE ($SIZE) uploaded to $BACKUP_REMOTE"
ping ""
