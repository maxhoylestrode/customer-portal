# Deploying Apex Portal on CapRover

Moving the live portal off the old Ubuntu/Nginx server onto CapRover without
losing anything or disrupting your current client.

**How it works:** you set everything up on CapRover and test it on a
temporary address using a copy of the real data, while the old server keeps
running untouched. Only once you're happy do you do a short final sync and
point the domain at CapRover. If anything looks wrong at any point before
that, you just stop; the old server is still live.

Everything runs through the CapRover dashboard and SSH. You don't need Node,
Postgres or the CapRover CLI on your own machine.

Names used below (change them if you like, but keep them consistent):

| What | Name |
|---|---|
| Postgres app | `apex-db` |
| Portal app | `apex-portal` |
| Backup app | `apex-backup` |
| Database | `apex_portal` |
| Database user | `apex` |

---

## Before you start

- [ ] The pull request into `master` on GitHub is merged. CapRover deploys
      from `master`; `main` is left as it was.
- [ ] SSH access to both the old server and the CapRover server.
- [ ] A GitHub personal access token CapRover can use to pull the repo:
      GitHub → Settings → Developer settings → Fine-grained tokens → only
      the `customer-portal` repo → **Contents: Read-only**.

---

## 1. Collect what you need from the old server

SSH into the old Ubuntu server.

**a) Its settings.** Find the portal's `.env` (usually `server/.env` inside
wherever the portal lives):

```bash
cat /path/to/customer-portal/server/.env
```

Keep a note of `JWT_SECRET`, `JWT_REFRESH_SECRET`, the `SMTP_*` values and
`ADMIN_EMAIL`. Reusing the two JWT secrets means your client stays logged in
through the move instead of being signed out.

**b) Its Postgres version:**

```bash
psql --version
```

The CapRover Postgres you create in step 2 must be the **same or newer** major
version.

---

## 2. Create the database on CapRover

Dashboard → **Apps** → **One-Click Apps/Databases** → search **PostgreSQL**.

| Field | Value |
|---|---|
| App Name | `apex-db` |
| Version | `17` (the default is 14.5, which is old; pick 17 unless the old server is newer) |
| Username | `apex` |
| Password | Generate a long one using **only letters and numbers** (symbols would need URL-encoding in the connection string) |
| Default Database | `apex_portal` |

Deploy it. Other apps reach it at `srv-captain--apex-db:5432`, so the
connection string for everything below is:

```
postgresql://apex:<password>@srv-captain--apex-db:5432/apex_portal
```

It isn't exposed to the internet, which is what you want.

---

## 3. Copy the data across (rehearsal)

This is a practice run using a copy. The old server keeps running normally.

**On the old server:**

```bash
# the database (use whichever works for how it was set up)
sudo -u postgres pg_dump -Fc apex_portal > ~/apex_portal.dump
#   or: pg_dump -Fc -h localhost -U <db user> <db name> > ~/apex_portal.dump

# the ticket attachment files
tar -czf ~/uploads.tgz -C /path/to/customer-portal/server uploads

# send both to the CapRover server
scp ~/apex_portal.dump ~/uploads.tgz <you>@<caprover-server>:~/
```

**On the CapRover server:**

```bash
PG=$(docker ps -q -f name=srv-captain--apex-db)
docker exec -i $PG pg_restore -U apex -d apex_portal --no-owner --no-privileges < ~/apex_portal.dump

# sanity check: should match what the old server has
docker exec $PG psql -U apex -d apex_portal -c "select count(*) as tickets from tickets"
```

---

## 4. Create and deploy the portal app

Do step 3 first: if the portal starts against an empty database it creates
fresh tables, and the old data then won't restore into them.

Dashboard → **Apps** → create `apex-portal`. Leave **Has Persistent Data**
unticked: everything, including uploaded files, lives in the database.

**a) App Configs → Environment Variables → Bulk Edit.** Paste this and fill
it in. Don't put quotes around values, even ones with spaces.

```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://apex:<password>@srv-captain--apex-db:5432/apex_portal
JWT_SECRET=<from the old server>
JWT_REFRESH_SECRET=<from the old server>
SMTP_HOST=<from the old server>
SMTP_PORT=<from the old server>
SMTP_USER=<from the old server>
SMTP_PASS=<from the old server>
SMTP_FROM=Apex Studio Codes <support@apexstudiocodes.co.uk>
ADMIN_EMAIL=<from the old server>
CLIENT_URL=https://apex-portal.<your-caprover-root-domain>
```

`CLIENT_URL` is the temporary test address for now; step 8 changes it to the
real domain. Save.

**b) HTTP Settings:** set **Container HTTP Port** to `3001`, save, then click
**Enable HTTPS** for the `apex-portal.<root-domain>` address.

**c) Deployment → Method 3: Deploy from Github/Bitbucket/Gitlab:**

| Field | Value |
|---|---|
| Repository | `github.com/maxhoylestrode/customer-portal` |
| Branch | `master` |
| Username | your GitHub username |
| Password | the personal access token |

**Save & Restart**, then **Force build**. The first build takes a few
minutes. Watch **Build logs** on that page.

> **If the build dies with "Killed" or exit code 137**, the server ran out of
> memory building the frontend. Add swap once, then Force build again:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

**d) Check it started.** Scroll to **App Logs**. On this first start against
the old data you should see:

```
Existing pre-Prisma database found: marking 20260924000000_baseline as already applied.
Applying migration `20260924000001_add_staff_portal_features`
...
Applying migration `20260928000000_reconcile_legacy_schema`
All migrations have been successfully applied.
Apex Portal API running on ...
```

That's the app recognising the old database and upgrading it in place. It
only adds tables and tidies column rules; it never deletes your data.

> **If it stops with "Tickets with no owner"**, the old database has a ticket
> not linked to any user. It refuses to guess. Assign it to the right
> client, clear the failed attempt, and restart the app:
> ```bash
> PG=$(docker ps -q -f name=srv-captain--apex-db)
> docker exec $PG psql -U apex -d apex_portal -c "UPDATE tickets SET user_id = <client id> WHERE id = <ticket id>"
> docker exec $PG psql -U apex -d apex_portal -c "DELETE FROM _prisma_migrations WHERE migration_name = '20260928000000_reconcile_legacy_schema' AND finished_at IS NULL"
> ```
> Then **Save & Restart** the app.
>
> **If it stops with "Accounts whose emails differ only by capitals"**, the
> old database has two accounts like `Alice@x.com` and `alice@x.com`. Login
> ignores capitals now, so it can't tell them apart. The message lists the
> user ids. Change the email of the one that isn't used (or delete it), then
> clear the failed attempt and restart as above:
> ```bash
> docker exec $PG psql -U apex -d apex_portal -c "UPDATE users SET email = 'old-duplicate@example.com' WHERE id = <unused id>"
> docker exec $PG psql -U apex -d apex_portal -c "DELETE FROM _prisma_migrations WHERE migration_name = '20260928000000_reconcile_legacy_schema' AND finished_at IS NULL"
> ```

**e) Push notification keys.** Generate them from inside the running app:

```bash
APP=$(docker ps -q -f name=srv-captain--apex-portal)
docker exec $APP node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Add these to the environment variables and save (the app restarts):

```
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:support@apexstudiocodes.co.uk
```

Generate these **once** and keep them. Changing them later silently breaks
everyone's existing push subscriptions.

**f) Auto-deploy on push (optional).** Copy the webhook URL shown under
Method 3. In GitHub → repo **Settings → Webhooks → Add webhook**: paste it,
content type `application/json`, **Just the push event**. Every push to
`master` then redeploys the portal.

---

## 5. Bring the old attachment files into the database

The old server kept ticket attachments as files on disk. This copies them
into the database so they survive every future redeploy.

```bash
mkdir -p ~/old-uploads && tar -xzf ~/uploads.tgz -C ~/old-uploads
APP=$(docker ps -q -f name=srv-captain--apex-portal)
docker cp ~/old-uploads/uploads $APP:/tmp/old-uploads
docker exec -e UPLOAD_DIR=/tmp/old-uploads $APP node scripts/backfill-attachments.js
```

It prints each file it copies. If it lists any as "had no file on disk",
those files were already missing on the old server too (their tickets are
fine, only that attachment won't open). It's safe to run again; it only
touches attachments that aren't in the database yet.

---

## 6. Set up nightly backups

Every ticket and every uploaded file is in this one database now. Set this up
before real clients use the new server.

**a) Somewhere to put them, off the CapRover server:**
- **Cloudflare R2** (10 GB free): create a bucket, then an API token with
  *Object Read & Write* on that bucket.
- **Backblaze B2** (10 GB free): create a private bucket and an application
  key for it.

**b) An alert if backups stop.** Create a free check at
[healthchecks.io](https://healthchecks.io): period **1 day**, grace a few
hours. Copy its ping URL. It emails you if a night is missed or fails.

**c) Create the app:** Apps → create `apex-backup`. In **HTTP Settings**, tick
**Do not expose as web-app** (it serves no website).

**d) Environment Variables → Bulk Edit:**

```
DATABASE_URL=postgresql://apex:<password>@srv-captain--apex-db:5432/apex_portal
BACKUP_REMOTE=backup:<bucket-name>
BACKUP_PASSPHRASE=<required; long random passphrase: SAVE THIS IN YOUR PASSWORD MANAGER>
BACKUP_PING_URL=<healthchecks.io ping URL>
```

Plus, for **Cloudflare R2**:

```
RCLONE_CONFIG_BACKUP_TYPE=s3
RCLONE_CONFIG_BACKUP_PROVIDER=Cloudflare
RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID=<token access key id>
RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY=<token secret>
RCLONE_CONFIG_BACKUP_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET=true
```

or for **Backblaze B2**:

```
RCLONE_CONFIG_BACKUP_TYPE=b2
RCLONE_CONFIG_BACKUP_ACCOUNT=<keyID>
RCLONE_CONFIG_BACKUP_KEY=<applicationKey>
```

Backups run at 3am UK time and are kept 30 days. Change that with
`BACKUP_SCHEDULE` (cron format) and `BACKUP_KEEP_DAYS`.

**e) Deployment:** fill in Method 3 exactly as for the portal (same repo,
branch and token). Then, at the bottom of the Deployment page, click
**Edit** next to **captain-definition path**, set it to
`./backup/captain-definition` and save. Then **Force build**. Don't add a
webhook for this one; it only needs rebuilding if the backup scripts change.

**f) Check it.** It runs one backup straight away. **App Logs** should show:

```
[backup] OK: apex-portal-2026-...dump.gpg (... ) uploaded to backup:...
```

and the healthchecks.io check turns green.

**g) Prove you can restore.** Restore into a throwaway database and look:

```bash
BK=$(docker ps -q -f name=srv-captain--apex-backup)
docker exec $BK psql "postgresql://apex:<password>@srv-captain--apex-db:5432/postgres" -c "CREATE DATABASE restore_test"
docker exec -it $BK restore.sh latest postgresql://apex:<password>@srv-captain--apex-db:5432/restore_test
docker exec $BK psql "postgresql://apex:<password>@srv-captain--apex-db:5432/restore_test" -c "select count(*) from tickets"
```

[`BACKUPS.md`](./BACKUPS.md) covers restoring for real, if you ever need to.

---

## 7. Test on the temporary address

Open `https://apex-portal.<root-domain>` and check:

- [ ] You can log in with your existing admin account
- [ ] Your client's tickets, statuses, comments and activity are all there
- [ ] Their old attachments open
- [ ] Create a test ticket with a photo from your phone (iPhone HEIC is fine)
- [ ] The new-ticket email reaches `ADMIN_EMAIL`
- [ ] **Forgotten your password?** on the login page sends an email (use your
      own account)
- [ ] Turn on push notifications on your profile and check one arrives
- [ ] The staff CRM pages load

Don't log in as your client or reset their password. The admin views show
everything you need.

If something's wrong, fix it and repeat; the old server is still serving
clients the whole time.

---

## 8. Cut over

Do this at a quiet time. Expect roughly 15 to 30 minutes where the portal is
unavailable.

**a) A day or so before:** lower the TTL on the portal's DNS record to 5
minutes, so the switch takes effect quickly.

**b) Stop the old portal** so nothing new is written to it (however it runs:
`sudo systemctl stop <service>`, `pm2 stop <name>`, etc.). Leave the server
itself and its data alone.

**c) Take a fresh copy.** Repeat the old-server commands from step 3 (dump,
tar, scp) so you capture anything added since the rehearsal.

**d) Replace the rehearsal data with it** (on the CapRover server):

```bash
PG=$(docker ps -q -f name=srv-captain--apex-db)
docker exec $PG psql -U apex -d postgres -c "DROP DATABASE apex_portal WITH (FORCE)" -c "CREATE DATABASE apex_portal"
docker exec -i $PG pg_restore -U apex -d apex_portal --no-owner --no-privileges < ~/apex_portal.dump
```

Then in the dashboard, **Save & Restart** `apex-portal`. The logs should show
the same "Existing pre-Prisma database found" upgrade as step 4d.

**e) Re-run the attachment step** (step 5) with the fresh `uploads.tgz`. Clear
the old copy first: `rm -rf ~/old-uploads`.

**f) Point the domain at CapRover.** Change the portal domain's DNS A record
to the CapRover server's IP. Then in `apex-portal` → **HTTP Settings** →
**Connect New Domain**: enter the domain, then **Enable HTTPS** and tick
**Force HTTPS**.

**g) Update `CLIENT_URL`** to the real domain (e.g.
`https://portal.apexstudiocodes.co.uk`) in the environment variables and save.
Email links use this.

**h) Check** the real domain loads, you can log in, and the client's tickets
are there. With the same domain and JWT secrets, your client stays signed in
and won't notice anything beyond the new "Forgotten your password?" link.

**i) Keep the old server** (stopped, not wiped) for a couple of weeks as a
fallback, then retire it. Keep `apex_portal.dump` somewhere safe as the
permanent record of exactly what the old server had.

---

## Everyday operations

- **Deploying changes:** push to `master` (with the webhook) or **Force build**.
  Database migrations run automatically on every start.
- **Logs:** each app's page → **App Logs**.
- **Restoring a backup:** see [`BACKUPS.md`](./BACKUPS.md).
- **Behind Cloudflare's proxy (orange cloud)?** Add `TRUST_PROXY_HOPS=2` to
  the portal's environment variables, otherwise login rate limiting treats
  every visitor as the same person.
