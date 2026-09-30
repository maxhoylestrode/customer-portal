# Nightly off-site Postgres backups for Apex Portal, deployed as its own
# CapRover app with its captain-definition path set to
# ./backup/captain-definition (see DEPLOY.md). CapRover builds from the repo
# root, so paths below are relative to it. pg_dump can dump any older server,
# so these Postgres 18 tools cover whatever version CapRover runs.
ARG PG_VERSION=18
FROM postgres:${PG_VERSION}-alpine

RUN apk add --no-cache rclone gnupg curl tzdata && touch /etc/rclone.conf

COPY backup/backup.sh backup/restore.sh backup/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

ENV TZ=Europe/London \
    RCLONE_CONFIG=/etc/rclone.conf \
    BACKUP_SCHEDULE="0 3 * * *" \
    BACKUP_KEEP_DAYS=30 \
    RUN_ON_START=true

ENTRYPOINT ["entrypoint.sh"]
