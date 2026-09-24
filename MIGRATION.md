# Migrating from the old Ubuntu/Nginx server to CapRover

This covers moving the **live** customer-portal (real client data, real ticket
attachments) off the old Ubuntu server and onto CapRover, without losing
anything.

## What's actually at risk, and what isn't

- **Ticket/user/client rows in Postgres** — not at risk. A standard
  `pg_dump`/`pg_restore` carries every row over exactly as it is. Redeploying
  the app itself never touches the database.
- **Ticket attachment files** — this is the one real risk. The version
  currently running on the Ubuntu server stores uploaded attachments as files
  on local disk (`server/uploads/`), with only a filename referenced in the
  `attachments` table. If you just deploy this new codebase against the old
  database and walk away, those files stay behind on the old server's disk —
  the new deployment has no way to see them, so old attachments would 404.
  Ticket records, statuses, comments, chat — all fine either way.

This new codebase already expects attachments to live as bytes in Postgres
(everything uploaded through it does that automatically), and it still knows
how to fall back to disk for old attachments that haven't been converted yet
— but only if it can find that same `uploads/` folder locally, which won't
be true on CapRover. The real fix is to convert the existing attachments
once, with the script below, so the problem is gone for good instead of
depending on carrying a folder around forever.

## Overview

1. Dump the database from the old server.
2. Restore it into CapRover's Postgres.
3. Backfill the old on-disk attachments into the database.
4. Deploy this app to CapRover, pointed at that restored database.
5. Test on a CapRover subdomain with the real migrated data before touching DNS.
6. Cut over.

## 1. Dump the database (on the old Ubuntu server)

```bash
pg_dump -Fc -h localhost -U <db_user> <db_name> > apex_portal.dump
```

`-Fc` (custom format) is compressed and lets `pg_restore` recreate things in
the right order. Copy `apex_portal.dump` off the server (`scp` to your
machine, or wherever you'll run the restore from).

Also copy the attachments folder while you're there:

```bash
scp -r <user>@<old-server>:/path/to/customer-portal/server/uploads ./old-uploads
```

## 2. Set up Postgres on CapRover

If you don't already have a Postgres app in CapRover, deploy one from the
One-Click Apps library (search "Postgres"). Note the internal address it
gives you, something like `srv-captain--apex-portal-db:5432`, plus the
user/password/db name you set.

Create the database if the one-click app didn't already:

```bash
psql -h <caprover-postgres-host> -U <db_user> -c "CREATE DATABASE apex_portal;"
```

## 3. Restore the dump into CapRover's Postgres

```bash
pg_restore -h <caprover-postgres-host> -U <db_user> -d apex_portal --no-owner --no-privileges apex_portal.dump
```

`--no-owner --no-privileges` avoids failures from role names that don't
exist on the new instance — you're the owner of the restored objects either
way.

This app's schema has grown since the old server's version (client CRM,
projects, notes, chat, etc. were all added in the merge). Tell Prisma the
baseline it already matches, then bring it up to date:

```bash
cd server
DATABASE_URL="postgresql://<db_user>:<pass>@<caprover-postgres-host>:5432/apex_portal" \
  npx prisma migrate resolve --applied 20260924000000_baseline
DATABASE_URL="postgresql://<db_user>:<pass>@<caprover-postgres-host>:5432/apex_portal" \
  npx prisma migrate deploy
```

This only *adds* the new tables — it never touches or drops the existing
`users`/`tickets`/`attachments`/`ticket_activity`/`refresh_tokens` rows you
just restored.

> If CapRover's Postgres isn't reachable from your machine directly, either
> run these commands from a throwaway container/session inside the same
> CapRover Docker network, or temporarily expose the Postgres port and lock
> it back down afterwards.

## 4. Backfill the old attachment files into the database

With `DATABASE_URL` still pointed at the restored CapRover database, and
`old-uploads` from step 1 available locally:

```bash
cd server
DATABASE_URL="postgresql://<db_user>:<pass>@<caprover-postgres-host>:5432/apex_portal" \
  UPLOAD_DIR=/path/to/old-uploads \
  npm run backfill:attachments
```

This reads every `attachments` row that has no DB bytes yet, reads the
matching file from `UPLOAD_DIR`, and writes it into `attachments.data`. It's
safe to re-run — it only ever touches rows where `data IS NULL`, and a
missing file is reported, not treated as fatal. Check the output for any
"had no file on disk" warnings before moving on; if there are none, every
attachment is now fully in Postgres and the on-disk fallback in the app code
will never be needed for these rows again.

## 5. Deploy the app to CapRover

From the repo root (this now has `Dockerfile` + `captain-definition`):

```bash
caprover deploy
```

(Or use the CapRover dashboard's "Deploy from GitHub/Bitbucket/GitLab" or
tarball upload if you're not using the CLI.)

In the CapRover app's **App Configs**, set:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | the CapRover Postgres connection string from step 2 |
| `JWT_SECRET` | same value as the old server, or a new one (see note below) |
| `JWT_REFRESH_SECRET` | same as above |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | your email provider's values |
| `ADMIN_EMAIL` | your admin notification address |
| `CLIENT_URL` | the URL clients will use, e.g. `https://portal.apexstudiocodes.co.uk` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | generate once with `node -e "console.log(require('web-push').generateVAPIDKeys())"` — see README |

**Note on JWT secrets:** if you reuse the old server's `JWT_SECRET`/
`JWT_REFRESH_SECRET`, everyone's existing login session (access + refresh
cookies) keeps working through the cutover — nobody has to log back in. If
you generate new ones, every user (including your active client) will be
logged out once and need to log in again. Neither breaks any data; it's
purely a convenience choice.

In **App Configs → Container HTTP Port**, set it to `3001` (matching
`PORT` above and the `EXPOSE 3001` in the Dockerfile), and enable HTTPS.

The container's `CMD` runs `npx prisma migrate deploy` on every start before
launching the server, so future deploys never need a manual migration step.

## 6. Test before cutover

CapRover gives every app a `<app-name>.<your-root-domain>` address
automatically — open that first. Log in with the real migrated account,
confirm:

- Existing tickets, statuses, and comments are all there
- Old attachments download correctly (this is the thing the backfill script
  fixed — if step 4 reported any missing files, those specific attachments
  will still 404 here, which is expected and matches what the old server
  would show too)
- New tickets/attachments/chat messages can be created

Only once that looks right, point your real domain (DNS, or CapRover's
"Connect New Domain" + your existing DNS record) at the CapRover app, and
retire the old Ubuntu server.

## Staff-portal note

Staff-portal is being retired, not migrated live — its data is low volume,
so a manual export/import (or just re-entering what's still relevant) is
fine; it doesn't need this same careful process.
