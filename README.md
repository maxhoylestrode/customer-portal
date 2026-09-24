# Apex Portal — Maintenance Ticket System

A full-stack client portal for Apex Studio Codes. Clients submit and track website maintenance requests; admins manage all tickets from a central dashboard.

---

## Tech Stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, React Router v6, TanStack Query, React Hook Form + Zod
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (raw SQL, no ORM)
- **Auth:** JWT (access + refresh tokens in httpOnly cookies)
- **Email:** Nodemailer (SMTP)
- **Uploads:** Local `/uploads` directory

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
Your tables already match the `20260924000000_baseline` migration, so mark it applied instead of running it, then deploy the rest:
```bash
cd server
npx prisma migrate resolve --applied 20260924000000_baseline
npx prisma migrate deploy
```
This only adds new tables (clients, projects, files, notes, meetings, etc.) — it never touches or drops your existing `users`/`tickets`/`attachments`/`ticket_activity`/`refresh_tokens` data.

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

### Password reset (admin-triggered)

1. Admin goes to **Clients → [Client Name] → Send Password Reset Email**
2. Client receives an email with a reset link valid for **1 hour**
3. Client sets a new password at `/reset-password/<token>`

---

## Project Structure

```
apex-portal/
├── client/          # React + Vite frontend
├── server/          # Express backend
├── database/
│   └── schema.sql   # PostgreSQL schema (reference only — Prisma migrations are the source of truth)
└── .env.example     # Environment variable template
```

All uploaded files (ticket attachments, avatars, client documents, internal storage, portal logo) are stored as bytes in Postgres, not on local disk — nothing is lost on redeploy. Each is served through its own authenticated/permission-checked route rather than static file serving.

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | Login |
| `POST /api/auth/logout` | Logout |
| `GET /api/auth/me` | Current user |
| `POST /api/auth/register` | Client self-registration (invite required) |
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

---

*Built for Apex Studio Codes — apexstudiocodes.co.uk — Somerset, UK*
