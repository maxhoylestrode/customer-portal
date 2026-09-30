# Database backups

Setup is in [`DEPLOY.md`](./DEPLOY.md), step 6. This covers how the backups
work and how to restore one.

## How it works

The `apex-backup` app (built from `backup/`) runs `pg_dump` every night,
checks the dump is readable, encrypts it with `BACKUP_PASSPHRASE`, uploads
it with [rclone](https://rclone.org), then deletes backups older than
`BACKUP_KEEP_DAYS` (default 30). Old backups are only deleted after a new one
has uploaded, so a broken job can never eat your last good copies. Every run
pings `BACKUP_PING_URL` (`/fail` on failure), so healthchecks.io emails you if
a night fails or doesn't happen at all.

Files are named `apex-portal-<date>T<time>.dump.gpg`.

## Commands

Open a shell in the backup app on the CapRover server:

```bash
docker exec -it $(docker ps -q -f name=srv-captain--apex-backup) sh
```

| Command | Does |
|---|---|
| `backup.sh` | Run a backup now |
| `restore.sh list` | List backups with sizes and dates |
| `restore.sh latest <database URL>` | Restore the newest backup into that database |
| `restore.sh <file name> <database URL>` | Restore a specific one |

`restore.sh` always needs the target database spelled out, so it can't
overwrite production by accident, and it waits 10 seconds before starting.

## Test a restore every few months

A backup you've never restored is a guess. Restore into a throwaway database
and look at it:

```bash
psql "postgresql://apex:<password>@srv-captain--apex-db:5432/postgres" -c "DROP DATABASE IF EXISTS restore_test" -c "CREATE DATABASE restore_test"
restore.sh latest postgresql://apex:<password>@srv-captain--apex-db:5432/restore_test
psql "postgresql://apex:<password>@srv-captain--apex-db:5432/restore_test" -c "select count(*) from tickets"
```

## Restoring for real

1. In CapRover, set `apex-portal`'s **Instance Count** to `0` (App Configs) so
   nothing writes while you restore.
2. From the backup app shell: `restore.sh latest "$DATABASE_URL"` (or name a
   specific file from `restore.sh list`).
3. Set the instance count back to `1`.

## If the whole CapRover server is gone

Backups live off the server, so on a new server: create `apex-db` (DEPLOY.md
step 2), deploy `apex-backup` with the same environment variables (step 6),
then run `restore.sh latest "$DATABASE_URL"` from it and deploy `apex-portal`.
You need `BACKUP_PASSPHRASE` for this: keep a copy somewhere other than the
server.
