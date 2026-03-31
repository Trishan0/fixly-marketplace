-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Categories (must come first, referenced by others)
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  icon        VARCHAR(50),
  is_active   BOOLEAN DEFAULT TRUE,
  parent_id   UUID REFERENCES categories(id)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  full_name           VARCHAR(255) NOT NULL,
  phone               VARCHAR(20),
  role                VARCHAR(20) NOT NULL CHECK (role IN ('customer','worker','admin')),
  area                VARCHAR(100),
  district            VARCHAR(100),
  profile_photo       VARCHAR(500),
  is_email_verified   BOOLEAN DEFAULT FALSE,
  email_verify_token  VARCHAR(255),
  is_nic_verified     BOOLEAN DEFAULT FALSE,
  nic_image_path      VARCHAR(500),
  nic_verified_by     UUID REFERENCES users(id),
  force_verified      BOOLEAN DEFAULT FALSE,
  is_suspended        BOOLEAN DEFAULT FALSE,
  dashboard_mode      VARCHAR(20) DEFAULT 'standard',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Worker profiles
CREATE TABLE IF NOT EXISTS worker_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio             TEXT,
  starting_price  VARCHAR(100),
  primary_skill   VARCHAR(100),
  total_jobs_done INT DEFAULT 0,
  avg_rating      NUMERIC(3,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Worker skills
CREATE TABLE IF NOT EXISTS worker_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  is_primary  BOOLEAN DEFAULT FALSE
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES users(id),
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  category_id         UUID REFERENCES categories(id),
  subcategory_id      UUID REFERENCES categories(id),
  district            VARCHAR(100),
  town                VARCHAR(100),
  address             TEXT,
  urgency             VARCHAR(50) CHECK (urgency IN ('today','tomorrow','this_week','flexible')),
  pricing_mode        VARCHAR(30) CHECK (pricing_mode IN ('fixed','ask_quotes','inspection')),
  fixed_budget        NUMERIC(12,2),
  status              VARCHAR(30) DEFAULT 'posted' CHECK (status IN (
                        'posted','proposals_received','assigned','in_progress',
                        'completed','payment_recorded','reviewed','cancelled'
                      )),
  assigned_worker_id  UUID REFERENCES users(id),
  final_price         NUMERIC(12,2),
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Job photos
CREATE TABLE IF NOT EXISTS job_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id    UUID REFERENCES jobs(id) ON DELETE CASCADE,
  path      VARCHAR(500) NOT NULL,
  order_idx INT DEFAULT 0
);

-- Worker portfolio photos
CREATE TABLE IF NOT EXISTS worker_portfolio_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES worker_profiles(id) ON DELETE CASCADE,
  path      VARCHAR(500) NOT NULL,
  order_idx INT DEFAULT 0
);

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id         UUID REFERENCES users(id),
  proposed_price    NUMERIC(12,2),
  inspection_needed BOOLEAN DEFAULT FALSE,
  availability      VARCHAR(255),
  message           TEXT,
  status            VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
                      'pending','accepted','declined','withdrawn'
                    )),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, worker_id)
);

-- Invites
CREATE TABLE IF NOT EXISTS invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id),
  worker_id   UUID REFERENCES users(id),
  message     TEXT,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, worker_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID UNIQUE REFERENCES jobs(id),
  amount            NUMERIC(12,2) NOT NULL,
  method            VARCHAR(50) CHECK (method IN ('cash','bank_transfer','other')),
  note              TEXT,
  recorded_by       UUID REFERENCES users(id),
  worker_confirmed  BOOLEAN DEFAULT FALSE,
  disputed          BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID UNIQUE REFERENCES jobs(id),
  customer_id UUID REFERENCES users(id),
  worker_id   UUID REFERENCES users(id),
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  feedback    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID REFERENCES users(id),
  reported_user_id  UUID REFERENCES users(id),
  job_id            UUID REFERENCES jobs(id),
  report_type       VARCHAR(50) CHECK (report_type IN (
                      'inappropriate_job','fake_job','no_show',
                      'abusive_behavior','fake_review','price_dispute','other'
                    )),
  description       TEXT,
  status            VARCHAR(20) DEFAULT 'open' CHECK (status IN (
                      'open','reviewing','dismissed','warned','actioned'
                    )),
  resolved_by       UUID REFERENCES users(id),
  resolution_note   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(255),
  body        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed categories
INSERT INTO categories (name, icon) VALUES
  ('Plumbing', 'droplets'),
  ('Electrical', 'plug-zap'),
  ('Carpentry', 'hammer'),
  ('Cleaning', 'sparkles'),
  ('Painting', 'paint-bucket'),
  ('Tiling', 'layers'),
  ('Welding', 'wrench'),
  ('AC Repair', 'wind'),
  ('Landscaping', 'leaf'),
  ('General Labour', 'user')
ON CONFLICT DO NOTHING;
