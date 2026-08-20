<p align="center">
  <img src="frontend/public/fixly-icon.svg" alt="Fixly" width="88" />
</p>

<h1 align="center">Fixly</h1>

<p align="center">
  <strong>A smarter way to find trusted local service professionals in Sri Lanka.</strong>
</p>

<p align="center">
  <a href="https://youtu.be/AeqSWpBVFg4">Watch the demo</a>
  &nbsp;·&nbsp;
  <a href="#getting-started">Get started</a>
  &nbsp;·&nbsp;
  <a href="#how-it-works">How it works</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 14+" />
  <img src="https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google-gemini&logoColor=white" alt="Google Gemini" />
</p>

---

Fixly is a hyperlocal marketplace for hiring skilled workers—from plumbers and electricians to cleaners and carpenters. Customers can post work, compare proposals, hire with confidence, and leave reviews. Workers get a practical workspace for discovering opportunities and managing their jobs.

The platform includes two purpose-built AI assistants: one helps customers identify strong candidates; the other helps workers turn their experience into a clear, tailored proposal.

## Why Fixly?

Finding reliable local help is often fragmented: referrals are informal, job requirements get lost in chats, and highly skilled workers can be overlooked because writing a polished proposal is difficult. Fixly brings the full hiring journey into one calm, structured experience.

| For customers | For workers |
| --- | --- |
| Post jobs with location, budget, and urgency | Discover relevant open jobs and direct invites |
| Review proposals and hire the best fit | Draft strong, job-specific proposals with AI |
| Track completion, payments, and reviews | Manage active work, notifications, and earnings |

## Highlights

- **Local-first discovery** — browse service professionals by skill and district.
- **A clear hiring flow** — post a job, receive proposals, hire, complete, and review.
- **AI Matchmaker** — ranks suitable workers using job context, skills, location, and profile signals, with an explanation for each recommendation.
- **AI Proposal Assistant** — generates a tailored starting point that workers can review and edit before submitting.
- **Role-aware workspaces** — dedicated customer, worker, and administrator dashboards.
- **Platform essentials** — JWT authentication, notifications, profile and portfolio support, payments, reviews, reporting, and moderation tools.

## How it works

```mermaid
flowchart LR
    C[Customer posts a job] --> M{Find a great fit}
    M -->|Browse| W[Explore local workers]
    M -->|AI Matchmaker| R[Ranked recommendations]
    W --> I[Invite or receive proposals]
    R --> I
    I --> H[Hire a worker]
    H --> D[Complete, pay & review]

    J[Worker sees job or invite] --> P[AI Proposal Assistant]
    P --> I
```

### The AI, with useful fallbacks

The backend uses a tool-calling/ReAct-style agent layer with Google Gemini. The Matchmaker retrieves relevant worker context before ranking candidates, while the Proposal Assistant maps a job’s needs to a worker’s profile. If the AI service is unavailable or rate-limited, deterministic scoring keeps the matching flow usable.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Client | React 18, Vite, Tailwind CSS, React Router, TanStack Query, Framer Motion |
| API | Node.js, Express, Zod |
| Data | PostgreSQL with `pg` |
| AI | Google Gemini via `@google/generative-ai` |
| Security | JWT, bcrypt, rate limiting, verification middleware |
| Supporting services | Nodemailer, Multer uploads |

## Project structure

```text
fixly-marketplace/
├── frontend/                    # React + Vite single-page application
│   ├── src/pages/               # Customer, worker, admin, and public screens
│   └── src/components/          # Reusable UI and AI-agent components
├── backend/                     # Express API
│   ├── src/agents/              # Gemini orchestration, scoring, and tools
│   ├── src/routes/              # REST endpoints
│   ├── src/services/            # Domain services
│   └── src/db/migrations/       # PostgreSQL schema and agent migrations
├── RUN_GUIDE.md                 # Detailed walkthrough for running and demoing
└── README.md
```

## Getting started

### Prerequisites

- Node.js 18 or newer
- PostgreSQL 14 or newer
- npm
- A Google Gemini API key for AI features (the rest of the marketplace can still run without it)

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Create the database

```bash
createdb fixly
```

If needed, pass your PostgreSQL username, for example: `createdb -U postgres fixly`.

### 3. Configure the backend

Create `backend/.env` and add your local configuration:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fixly
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
PORT=4000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Optional for marketplace emails
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@fixly.lk

# Required to enable AI assistants
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Initialise the schema and demo data

From `backend/`:

```bash
node setup-db.js

# Load the additional authentication and AI-agent tables.
set -a; source .env; set +a
psql "$DATABASE_URL" -f src/db/migrations/002_auth_hardening.sql
psql "$DATABASE_URL" -f src/db/migrations/003_agent_tables.sql

# Optional: populate richer jobs and worker profiles for the AI demo.
node src/db/seed_agent_demo_data.js
```

### 5. Start Fixly

Open two terminals:

```bash
# Terminal 1 — API
cd backend && npm run dev

# Terminal 2 — web app
cd frontend && npm run dev
```

Visit [http://localhost:5173](http://localhost:5173). The API health check is available at [http://localhost:4000/api/health](http://localhost:4000/api/health).

## Demo accounts

`node setup-db.js` creates these basic accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@fixly.lk` | `admin123` |
| Customer | `customer@demo.lk` | `demo123` |
| Worker | `worker@demo.lk` | `demo123` |

After running the optional rich demo seed, use `password123` for the additional worker accounts, such as `kamal.plumber@demo.lk`, `nimal.electrician@demo.lk`, and `chaminda.ac@demo.lk`.

## Try the full experience

1. Sign in as the customer and post a job—for example, a leaking pipe in Colombo.
2. Open the job and run **Find Best Workers** to see the AI Matchmaker’s ranked recommendations.
3. Invite a recommended worker, or switch to a worker account and browse open jobs.
4. Use **Draft Proposal with AI**, personalise the draft, and submit it.
5. Return to the customer account to hire, complete the job, record a payment, and leave a review.

For a fuller run-through, see [RUN_GUIDE.md](RUN_GUIDE.md) or [watch the video demo](https://youtu.be/AeqSWpBVFg4).

## Notes for contributors

- Keep secrets in `backend/.env`; never commit credentials or API keys.
- The backend automatically tries the next available port if the configured one is occupied. Update `CLIENT_URL` and the frontend proxy configuration if you deliberately use a different API port.
- Build the client for a production sanity check with `cd frontend && npm run build`.

---

<p align="center">Built to make local work easier to find, understand, and trust.</p>
