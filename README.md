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

Create a PostgreSQL database:
```bash
createdb apex_portal
psql -d apex_portal -f database/schema.sql
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
│   └── uploads/     # Uploaded files (auto-created)
├── database/
│   └── schema.sql   # PostgreSQL schema
└── .env.example     # Environment variable template
```

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
| `GET /api/uploads/:filename` | Serve uploaded file |

---

*Built for Apex Studio Codes — apexstudiocodes.co.uk — Somerset, UK*
