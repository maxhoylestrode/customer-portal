#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE is required, e.g. backup:apex-portal-backups}"
# Backups hold every client file and message; never upload them unencrypted
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required so backups are encrypted}"

# cron jobs don't inherit the container environment, so hand it over explicitly
export -p > /etc/backup.env
chmod 600 /etc/backup.env

if [ "${RUN_ON_START:-true}" = "true" ]; then
  /usr/local/bin/backup.sh || true
fi

echo "${BACKUP_SCHEDULE} /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] scheduled: ${BACKUP_SCHEDULE} (${TZ})"
exec crond -f -l 8
