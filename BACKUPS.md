# Database backups

Every ticket, message, client record **and every uploaded file** lives in the
Postgres database. If that database volume is lost, everything is lost. This
sets up a nightly encrypted backup to storage that isn't on your CapRover
server, plus an alert if a backup ever fails or stops running.

The `backup/` folder is a small container you deploy as a second CapRover app.
Each night it runs `pg_dump`, checks the dump is readable, encrypts it,
uploads it with [rclone](https://rclone.org), then deletes backups older than
`BACKUP_KEEP_DAYS`. Old backups are only pruned after a new one has uploaded
successfully, so a broken job can never eat your last good copies.

## 1. Pick where backups go

Anything rclone supports works. Two cheap, sensible options:

- **Cloudflare R2** (10 GB free, no download fees). Create a bucket, then an
  API token with *Object Read & Write* on that bucket.
- **Backblaze B2** (10 GB free). Create a private bucket and an application key
  for it.

## 2. Set up a "backups stopped" alert (recommended)

Backups that silently stopped working months ago are the classic way to lose
everything. Create a free check at [healthchecks.io](https://healthchecks.io)
with a period of **1 day** and a grace of a few hours. Copy its ping URL. It
emails you if a night is missed or a backup reports a failure.

## 3. Deploy on CapRover

1. Create a new app, e.g. `apex-db-backup`. It serves no website, so in its
   **HTTP Settings** tick **Do not expose as web-app**.
2. In **App Configs → Environment Variables**, set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Same value the portal app uses |
   | `BACKUP_REMOTE` | `backup:<bucket-name>` (optionally `backup:<bucket>/<folder>`) |
   | `BACKUP_PASSPHRASE` | A long random passphrase. **Save it in your password manager.** Without it the backups can't be opened. |
   | `BACKUP_PING_URL` | Your healthchecks.io ping URL (optional but do it) |
   | `BACKUP_SCHEDULE` | Cron schedule, default `0 3 * * *` (3am) |
   | `BACKUP_KEEP_DAYS` | Default `30` |
   | `TZ` | Default `Europe/London` |

   Plus the storage credentials. For **Cloudflare R2**:

   ```
   RCLONE_CONFIG_BACKUP_TYPE=s3
   RCLONE_CONFIG_BACKUP_PROVIDER=Cloudflare
   RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID=<token access key id>
   RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY=<token secret>
   RCLONE_CONFIG_BACKUP_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET=true
   ```

   For **Backblaze B2**:

   ```
   RCLONE_CONFIG_BACKUP_TYPE=b2
   RCLONE_CONFIG_BACKUP_ACCOUNT=<keyID>
   RCLONE_CONFIG_BACKUP_KEY=<applicationKey>
   ```

3. Deploy the `backup/` folder as that app. It has its own
   `captain-definition`, so upload it as a tarball:

   ```bash
   cd backup
   tar -cf ../backup.tar .
   caprover deploy -t ../backup.tar -a apex-db-backup
   ```

   (Or upload `backup.tar` under the app's **Deployment → Tarball** section.)

4. Open the app's logs. It runs one backup straight away, so within a minute
   you should see `[backup] OK: apex-portal-....dump.gpg (...) uploaded`.
   If you see `FAILED`, the line above it says why (usually a typo in
   `DATABASE_URL` or the storage keys).

## 4. Test a restore (do this now, then every few months)

A backup you've never restored is a guess. Restore into a **scratch** database
and look at it:

```bash
# on the CapRover server
docker exec -it $(docker ps -q -f name=srv-captain--apex-db-backup) sh

# inside the container
restore.sh list
psql "$DATABASE_URL" -c "CREATE DATABASE restore_test"   # once
restore.sh latest postgresql://<user>:<pass>@<postgres-host>:5432/restore_test
psql postgresql://<user>:<pass>@<postgres-host>:5432/restore_test -c "select count(*) from tickets"
```

`restore.sh` always makes you type the target database, so it can't overwrite
production by accident. It waits 10 seconds before starting.

## Restoring for real

1. Scale the portal app to **0 instances** in CapRover so nothing writes
   while you restore.
2. From inside the backup container:
   `restore.sh latest "$DATABASE_URL"` (or name a specific file from
   `restore.sh list`).
3. Scale the portal back to 1.

## Notes

- `pg_dump` can dump any older Postgres server, so the default image (Postgres
  18 tools) works whatever version your CapRover Postgres runs.
- Keep a copy of the passphrase somewhere other than the CapRover server.
- Before cutting over from the old Ubuntu server, keep the `pg_dump` you made
  there as a "day zero" copy, separate from these rolling backups.
