# Nightly off-site Postgres backups for Apex Portal. Deploy as its own
# CapRover app — see BACKUPS.md. pg_dump from a newer major version can dump
# older servers, so 18 covers any Postgres your CapRover instance runs today.
ARG PG_VERSION=18
FROM postgres:${PG_VERSION}-alpine

RUN apk add --no-cache rclone gnupg curl tzdata && touch /etc/rclone.conf

COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

ENV TZ=Europe/London \
    RCLONE_CONFIG=/etc/rclone.conf \
    BACKUP_SCHEDULE="0 3 * * *" \
    BACKUP_KEEP_DAYS=30 \
    RUN_ON_START=true

ENTRYPOINT ["entrypoint.sh"]
