# Fixly - Hyperlocal Service Marketplace

Sri Lanka's platform connecting residents with trusted local skilled workers.

## 🚀 Local Setup Guide

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone and Install

```bash
cd fixly-marketplace
cd backend
npm install

cd ../frontend
npm install
```

### 2. Create the PostgreSQL Database

Create a local database named `fixly`.

#### Option A: Standard local PostgreSQL install

```bash
psql -U postgres -d postgres
```

Then run:

```sql
CREATE DATABASE fixly;
```

If your machine uses peer authentication and `psql -U postgres` fails, use:

```bash
sudo -u postgres psql -d postgres
```

Then create the database with the same SQL command.

#### Option B: If you already have a Postgres user and password

```bash
createdb -U <username> fixly
```

### 3. Configure Backend Environment Variables

From the backend folder, copy the example environment file:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set a real PostgreSQL connection string.

Example:

```env
DATABASE_URL=postgresql://postgres:admin@localhost:5432/fixly
JWT_SECRET=fixly_jwt_secret_change_in_production
JWT_EXPIRES_IN=7d

# SMTP (use Mailtrap for dev: https://mailtrap.io)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
EMAIL_FROM=noreply@fixly.lk

PORT=4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

If you use a different Postgres username, password, or port, update the URL accordingly.

### 4. Run Database Migrations and Seed Data

From the backend folder:

```bash
node setup-db.js
```

This script:
- creates the schema
- seeds demo categories
- creates demo accounts
- inserts starter worker/customer/admin data

If this command fails with a password or authentication error, verify that `DATABASE_URL` in `backend/.env` matches your local PostgreSQL user.

### 5. Start the Backend API

```bash
npm run dev
```

The backend runs at:

```bash
http://localhost:4000
```

### 6. Start the Frontend App

In a second terminal:

```bash
cd frontend
npm run dev
```

The frontend runs at:

```bash
http://localhost:5173
```

### 7. Demo Accounts

After running `node setup-db.js`, use these accounts:

| Role     | Email            | Password |
| -------- | ---------------- | -------- |
| Admin    | admin@fixly.lk   | admin123 |
| Customer | customer@demo.lk | demo123  |
| Worker   | worker@demo.lk   | demo123  |

### 8. Local Startup Checklist

Before opening the app, confirm:

1. PostgreSQL is running.
2. The `fixly` database exists.
3. `backend/.env` exists and contains a valid `DATABASE_URL`.
4. `node setup-db.js` completed successfully.
5. The backend server is running on port `4000`.
6. The frontend server is running on port `5173`.

### 9. Common PostgreSQL Issues

#### Peer authentication failed

If you see a peer authentication error, your local Postgres install expects the operating system user to match the database user. Use:

```bash
sudo -u postgres psql
```

Or update `DATABASE_URL` to use a role that exists on your machine.

#### Password authentication failed

If the password in `DATABASE_URL` is wrong, reset it in Postgres or change the URL to match the real password.

#### Database already exists

If `fixly` already exists, you can keep it and just run `node setup-db.js` again.

#### Permission denied when connecting

Make sure the Postgres server is running and that the port in `DATABASE_URL` matches your local installation.

---

## Architecture

```
fixly/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── app.js           # Main Express server
│   │   ├── routes/          # All API routes
│   │   ├── middleware/       # Auth, upload, verified
│   │   ├── services/         # Business logic
│   │   └── db/              # PostgreSQL pool + migrations
│   ├── uploads/             # Local file storage
│   └── setup-db.js          # DB setup + seed script
│
└── frontend/                # React + Vite SPA
    └── src/
        ├── App.jsx           # Router
        ├── context/          # Auth context
        ├── components/       # Shared UI + layout
        ├── pages/            # All page components
        │   ├── customer/     # Customer-specific pages
        │   ├── worker/       # Worker-specific pages
        │   ├── admin/        # Admin panel
        │   ├── public/       # Public pages
        │   └── shared/       # Profile, Notifications
        ├── hooks/            # Custom hooks
        └── lib/              # API client, utils
```

---

## API Overview

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| POST   | /api/auth/register        | Register user          |
| POST   | /api/auth/login           | Login                  |
| GET    | /api/auth/me              | Current user           |
| GET    | /api/workers              | Public worker catalog  |
| POST   | /api/jobs                 | Post a job (customer)  |
| GET    | /api/jobs/feed            | Open jobs (worker)     |
| GET    | /api/jobs/my              | My jobs (customer)     |
| POST   | /api/jobs/:id/proposals   | Send proposal (worker) |
| PUT    | /api/proposals/:id/accept | Accept proposal        |
| POST   | /api/jobs/:id/invites     | Invite worker          |
| POST   | /api/jobs/:id/payment     | Record payment         |
| POST   | /api/jobs/:id/review      | Submit review          |
| GET    | /api/admin/stats          | Admin dashboard        |

Full API: see `backend/src/routes/`

---

## Key Business Rules

1. **Email verification** - Required to post jobs (admin can bypass with `force_verified`)
2. **Phone masking** - Phones shown as `077 *** *567` until job is assigned
3. **Price visibility** - Only job owner sees full prices; others see range
4. **Job status flow** - `posted → proposals_received → assigned → in_progress → completed → payment_recorded → reviewed`
5. **Offline payments** - No payment gateway; records are manual
6. **Simplified worker mode** - Large-button UI for low-digital-literacy users

---

## Phase 2 Roadmap

- SMS OTP login
- In-app chat
- GPS-based worker discovery
- Push/SMS notifications
- Worker tier system (Bronze/Silver/Gold)
- Mobile app (React Native)
