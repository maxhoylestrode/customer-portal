#!/bin/sh
# Usage:
#   restore.sh list
#   restore.sh <latest|backup file name> <target database URL>
#
# The target is always given explicitly so production is never overwritten by
# accident. Restore into a scratch database first to check a backup is good.
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env

if [ "${1:-}" = "list" ]; then
  rclone lsl "$BACKUP_REMOTE" --include "apex-portal-*" | sort -k2,3
  exit 0
fi

if [ $# -ne 2 ]; then
  sed -n '2,7p' "$0"
  exit 1
fi

NAME="$1"
TARGET=$(printf '%s' "$2" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')
if [ "$NAME" = "latest" ]; then
  NAME=$(rclone lsf "$BACKUP_REMOTE" --files-only --include "apex-portal-*" | sort | tail -n 1)
  [ -n "$NAME" ] || { echo "No backups found in $BACKUP_REMOTE"; exit 1; }
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "Restoring $NAME"
echo "INTO $(printf '%s' "$TARGET" | sed -E 's#://([^:]+):[^@]*@#://\1:***@#')"
echo "Existing tables in that database will be replaced. Ctrl+C within 10 seconds to abort."
sleep 10

rclone copyto "$BACKUP_REMOTE/$NAME" "$WORK/$NAME"
DUMP="$WORK/$NAME"
case "$NAME" in
  *.gpg)
    : "${BACKUP_PASSPHRASE:?this backup is encrypted; BACKUP_PASSPHRASE is required}"
    DUMP="$WORK/restore.dump"
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet --passphrase-fd 0 --pinentry-mode loopback \
      -o "$DUMP" -d "$WORK/$NAME"
    ;;
esac

pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET" "$DUMP"
echo "Restore complete."
