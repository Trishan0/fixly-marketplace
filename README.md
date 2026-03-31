# Fixly — Hyperlocal Service Marketplace

Sri Lanka's platform connecting residents with trusted local skilled workers.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

---

## 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE fixly;"

# Or if using the default odoo user from .env:
psql -U odoo -c "CREATE DATABASE fixly;"
```

---

## 2. Backend Setup

```bash
cd backend
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, and SMTP settings

# Run database migrations + seed demo data
node setup-db.js

# Start the server
npm run dev
# → API running at http://localhost:4000
```

### Backend Environment Variables (`.env`)

```env
DATABASE_URL=postgresql://odoo:odoo@localhost:5432/fixly
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

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# → App running at http://localhost:5173
```

---

## 4. Demo Accounts

After running `node setup-db.js`:

| Role     | Email                 | Password |
|----------|-----------------------|----------|
| Admin    | admin@fixly.lk        | admin123 |
| Customer | customer@demo.lk      | demo123  |
| Worker   | worker@demo.lk        | demo123  |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| GET | /api/workers | Public worker catalog |
| POST | /api/jobs | Post a job (customer) |
| GET | /api/jobs/feed | Open jobs (worker) |
| GET | /api/jobs/my | My jobs (customer) |
| POST | /api/jobs/:id/proposals | Send proposal (worker) |
| PUT | /api/proposals/:id/accept | Accept proposal |
| POST | /api/jobs/:id/invites | Invite worker |
| POST | /api/jobs/:id/payment | Record payment |
| POST | /api/jobs/:id/review | Submit review |
| GET | /api/admin/stats | Admin dashboard |

Full API: see `backend/src/routes/`

---

## Key Business Rules

1. **Email verification** — Required to post jobs (admin can bypass with `force_verified`)
2. **Phone masking** — Phones shown as `077 *** *567` until job is assigned
3. **Price visibility** — Only job owner sees full prices; others see range
4. **Job status flow** — `posted → proposals_received → assigned → in_progress → completed → payment_recorded → reviewed`
5. **Offline payments** — No payment gateway; records are manual
6. **Simplified worker mode** — Large-button UI for low-digital-literacy users

---

## Phase 2 Roadmap

- SMS OTP login
- In-app chat
- GPS-based worker discovery
- Push/SMS notifications
- Worker tier system (Bronze/Silver/Gold)
- Mobile app (React Native)
