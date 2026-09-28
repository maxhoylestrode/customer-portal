# Apex Portal — Maintenance Ticket System

A full-stack client portal for Apex Studio Codes. Clients submit and track website maintenance requests; admins manage all tickets from a central dashboard.

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, React Router v6, TanStack Query, React Hook Form + Zod
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (raw SQL, no ORM)
- **Auth:** JWT (access + refresh tokens in httpOnly cookies)
- **Email:** Nodemailer (SMTP)
- **Uploads:** Stored as bytes in Postgres (see below) — nothing on local disk
- **Deployment:** Docker / CapRover (`Dockerfile` + `captain-definition`)

---

## Setup

### 1. Clone & install

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Database

The schema is managed with Prisma. `database/schema.sql` is kept for reference only (it documents the original table shapes) — migrations are the source of truth.

**New setup:**
```bash
createdb apex_portal
cd server && npx prisma migrate deploy
```

**Existing database (upgrading from before the staff-portal merge):**
`npm start` (and the Docker image) handle this automatically: `scripts/prepare-db.js` spots a database that has the old tables but no migration history, marks the baseline as applied, and `prisma migrate deploy` then adds the new tables and tidies the old column rules. It never drops your existing `users`/`tickets`/`attachments`/`ticket_activity`/`refresh_tokens` data. To do it by hand:
```bash
cd server
node scripts/prepare-db.js
npx prisma migrate deploy
```

### 3. Environment variables

```bash
cp .env.example server/.env
```

Edit `server/.env` with your values:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/apex_portal
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=support@apexstudiocodes.co.uk
SMTP_PASS=your_email_password
SMTP_FROM=Apex Studio Codes <support@apexstudiocodes.co.uk>
ADMIN_EMAIL=support@apexstudiocodes.co.uk
CLIENT_URL=http://localhost:5173
```

### 4. Seed the admin account

Generate a bcrypt hash for your admin password, then insert directly into the database:

```bash
# Quick way — use Node to generate a hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword123', 12).then(h => console.log(h));"
```

Then in psql:
```sql
INSERT INTO users (name, email, password_hash, role)
VALUES ('Max', 'your@email.com', '<bcrypt_hash_here>', 'admin');
```

### 5. Add logo

Place your logo file at:
```
client/public/logo.png
```

### 6. Start development

```bash
# Backend (port 3001)
cd server && npm run dev

# Frontend (port 5173) — in a separate terminal
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## User Flows

### Admin creates a new client

1. Go to **Clients → Add Client** (or Send Invite)
2. Enter the client's name, email, and optional details
3. An invite email is automatically sent with a registration link
4. The link expires after **48 hours**

### Client registers via invite link

1. Client clicks the link in their email → `/register?invite=<token>`
2. They complete their name, email, password, and optional details
3. On success, they're logged in automatically

### Password reset

Clients can do this themselves: **Forgotten your password?** on the login page
emails them a reset link (valid for **1 hour**). The page gives the same
answer whether or not the email has an account, so it can't be used to find
out who your clients are.

An admin can also trigger it from **Clients → [Client Name] → Send Password
Reset Email**. Either way, resetting a password signs that account out on
every other device.

---

## Security notes

- **Sessions:** deactivating an account, changing someone's role, or resetting
  a password takes effect immediately. The server checks the account on every
  request instead of trusting what's baked into the login token.
- **Brute force:** 10 failed logins per IP per 15 minutes, 5 password-reset
  requests per IP per hour. Successful logins never count.
- **Uploaded files** are served with a Content-Type worked out from the file
  extension (never what the uploader's browser claimed), `nosniff`, and a
  sandbox CSP, so an uploaded file can't run script in the portal. Non-ASCII
  filenames (e.g. macOS screenshots) are stored and downloaded intact.
- **Emails** escape everything user-supplied (names, ticket titles, notes,
  chat messages).
- **Emails are case-insensitive** for login and duplicate checks, and stored
  lowercase.
- `helmet` sets standard security headers and a CSP for the app itself.

---

## Project Structure

```
apex-portal/
├── client/               # React + Vite frontend
├── server/               # Express backend
├── database/
│   └── schema.sql        # PostgreSQL schema (reference only — Prisma migrations are the source of truth)
├── Dockerfile            # Multi-stage build: client + server → single runtime image
├── captain-definition    # Points CapRover at the Dockerfile
├── DEPLOY.md             # Step-by-step CapRover setup, data migration from the old server, and cutover
├── backup/               # Nightly encrypted off-site Postgres backup (separate CapRover app)
├── BACKUPS.md            # How the backups work and how to restore one
└── .env.example          # Environment variable template
```

All uploaded files (ticket attachments, avatars, client documents, internal storage, portal logo) are stored as bytes in Postgres, not on local disk — nothing is lost on redeploy. Each is served through its own authenticated/permission-checked route rather than static file serving.

---

## Deployment (CapRover)

The `Dockerfile` builds the React client and the Express server in separate
stages, then runs them as a single container: Express serves `/api/*` and
also serves the built client with an SPA fallback, so there's nothing else
to host separately.

On every start the container runs `scripts/prepare-db.js` (which recognises
a database restored from the old pre-Prisma server and records its baseline)
and then `prisma migrate deploy`, so schema changes ship with the code and
there's no manual migration step.

**Backups:** every file lives in the database, so set up the nightly
off-site backup in [`BACKUPS.md`](./BACKUPS.md) before real clients use it.

**Setting it up on CapRover, including moving the live data off the old
server:** follow [`DEPLOY.md`](./DEPLOY.md) top to bottom.

---

## Installable App (PWA)

The client is a Progressive Web App — visitors can install it like a native app (its own window/icon, no app store) from any browser that supports it:

- **Desktop Chrome/Edge:** an install icon appears in the address bar, or use the browser menu → "Install Apex Portal"
- **Android Chrome:** menu → "Add to Home screen" / "Install app"
- **iOS Safari:** Share → "Add to Home Screen"

This works identically for the client ticket portal and the staff CRM — whoever installs it gets the same app, and still lands on whichever section their role gives them access to.

Implementation (`client/vite-plugin-pwa` in `vite.config.ts`):
- The manifest (name, icons, `display: "standalone"`) is generated at build time — nothing to configure per-deploy.
- Icons live in `client/public/icons/`, generated from `client/public/logo.png`. Regenerate them if the logo changes (any image-resize tool works — 192×192, 512×512, a 512×512 maskable variant with ~30% padding, a 180×180 apple-touch-icon, and a 32×32 favicon).
- A service worker (`client/src/sw.ts`, custom — not auto-generated, since it needs `push`/`notificationclick` handlers) precaches the built app shell (JS/CSS/HTML) so the app opens instantly. There's no fetch handler for anything else, so **every `/api/*` request passes straight through to the network** — the service worker never serves ticket/CRM/chat data from cache, only the static shell. That's deliberate: this is a live data app, not a content site.
- `npm run build && npm run preview` serves the production build locally (with the same `/api` proxy as `dev`) if you want to test the installed-app experience before deploying.

### Push Notifications

Both sides can opt in from their Profile page ("Push Notifications" → Turn on), which requests browser notification permission and registers a subscription per device:

| Who | Notified when |
|-----|----------------|
| Admin | A new ticket comes in; a client sends a chat message |
| Client | Their ticket's status changes; admin replies to their chat message |

This is in addition to the existing email notifications, not a replacement — email keeps going to `ADMIN_EMAIL` / the client's account email exactly as before.

Setup:
1. Generate a VAPID key pair once: `node -e "console.log(require('web-push').generateVAPIDKeys())"`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `server/.env` (see `.env.example`). Without these, push is silently disabled (`/api/push/vapid-public-key` reports `enabled: false`) — everything else keeps working.
3. That's it — no third-party push service account needed. Web Push delivers through the browser vendor's own infrastructure (Chrome/Edge → Google, Firefox → Mozilla, Safari → Apple); the VAPID keys are how your server authenticates to them, not an API key you sign up for.

A subscription that a push service reports as gone (the browser uninstalled, permission revoked, etc.) is deleted automatically the next time a push is attempted against it.

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | Login |
| `POST /api/auth/logout` | Logout |
| `GET /api/auth/me` | Current user |
| `POST /api/auth/register` | Client self-registration (invite required) |
| `POST /api/auth/forgot-password` | Request a reset link (always returns the same response) |
| `POST /api/auth/reset-password/confirm` | Confirm password reset |
| `GET /api/tickets` | List tickets |
| `POST /api/tickets` | Create ticket |
| `PATCH /api/tickets/:id` | Update ticket |
| `DELETE /api/tickets/:id` | Delete ticket (admin only) |
| `GET /api/admin/stats` | Dashboard statistics |
| `GET /api/admin/users` | List clients |
| `POST /api/admin/users` | Create client |
| `PATCH /api/admin/users/:id` | Update client |
| `POST /api/admin/users/:id/reset-password` | Trigger password reset |
| `GET /api/tickets/:id/attachments/:attachmentId` | Download/view a ticket attachment |
| `GET/POST /api/tickets/:id/messages` | Chat thread on a ticket (separate from the status/activity log) |

### Staff routes (internal team — admin/staff/sales roles only)

Roles: `admin` (full access), `staff` (no client-role restrictions), `sales` (blocked from `/api/projects` and availability management; auto-scoped to their own clients on the dashboard). Client-role portal users get `403` on all of these.

| Prefix | Description |
|--------|-------------|
| `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/:id` | Client CRM records |
| `POST/DELETE /api/clients/:id/avatar`, `GET /api/clients/:id/avatar` | Client avatar |
| `PUT /api/clients/:id/portal-link`, `GET /api/clients/portal-users` | Link a client CRM record to its ticket-portal login |
| `POST /api/clients/:id/files` | Upload a client document |
| `GET /api/clients/:clientId/notes`, `POST /api/clients/:clientId/notes` | Notes on a client |
| `PUT/DELETE /api/notes/:id` | Edit/delete a client note |
| `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` | Projects + milestones |
| `GET /api/files/:fileId/view`, `/download`, `DELETE /api/files/:fileId` | Client document access |
| `GET /api/dashboard/stats` | Staff CRM dashboard |
| `GET/PUT /api/settings/branding`, `GET/POST/DELETE /api/settings/logo` | Portal branding (logo GET is public) |
| `PUT /api/settings/profile` | Own staff profile |
| `GET/POST /api/settings/users`, `PUT/DELETE /api/settings/users/:id` | Manage admin/staff/sales accounts |
| `GET/POST /api/storage`, `GET /api/storage/folders` | Internal file storage |
| `PATCH /api/storage/:fileId/permissions` | Set storage file sharing |
| `GET /api/storage/:fileId/view`, `/download`, `DELETE /api/storage/:fileId` | Storage file access |
| `GET/POST /api/general-notes`, `PUT/DELETE /api/general-notes/:id` | Team notes (public or private) |
| `GET/POST /api/meetings/available-slots`, `DELETE /api/meetings/available-slots/:id` | Calendar availability |
| `GET/POST /api/meetings`, `PUT/DELETE /api/meetings/:id` | Booked meetings |
| `GET /api/users` | List internal accounts (assignee pickers) |
| `GET /api/search?q=` | Global search across clients, notes, and (role-permitting) tickets/projects |
| `GET /api/push/vapid-public-key` | Public key the browser needs to subscribe |
| `POST/DELETE /api/push/subscribe`, `/unsubscribe` | Register/remove a push subscription for this device (client or admin) |

---

*Built for Apex Studio Codes — apexstudiocodes.co.uk — Somerset, UK*
