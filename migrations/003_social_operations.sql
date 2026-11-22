-- Social operations foundation. Existing order/world tables are intentionally untouched.
CREATE TABLE IF NOT EXISTS suraya_social_accounts (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(32) NOT NULL,
  account_label VARCHAR(160) NOT NULL,
  external_account_id VARCHAR(200),
  connection_status VARCHAR(24) NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('disconnected','pending_oauth','connected','expired','revoked','error')),
  token_ciphertext TEXT,
  token_key_version VARCHAR(32),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  account_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, external_account_id)
);
CREATE INDEX IF NOT EXISTS suraya_social_accounts_platform_idx ON suraya_social_accounts(platform, connection_status);

CREATE TABLE IF NOT EXISTS suraya_social_posts (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE DEFAULT ('SPOST-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,12))),
  platform VARCHAR(32) NOT NULL,
  account_id BIGINT REFERENCES suraya_social_accounts(id) ON DELETE SET NULL,
  title VARCHAR(240) NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '',
  script TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type VARCHAR(24) NOT NULL DEFAULT 'none' CHECK (media_type IN ('none','image','video','live')),
  status VARCHAR(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','in_review','approved','scheduled','publishing','published','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  idempotency_key TEXT UNIQUE,
  failure_code VARCHAR(80),
  failure_message TEXT,
  created_by VARCHAR(160) NOT NULL DEFAULT 'operator',
  approved_by VARCHAR(160),
  approved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_social_posts_status_schedule_idx ON suraya_social_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS suraya_social_posts_platform_created_idx ON suraya_social_posts(platform, created_at DESC);

CREATE TABLE IF NOT EXISTS suraya_social_audience_snapshots (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES suraya_social_accounts(id) ON DELETE CASCADE,
  source VARCHAR(80) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics JSONB NOT NULL,
  UNIQUE(account_id, source, captured_at)
);
CREATE INDEX IF NOT EXISTS suraya_social_audience_account_idx ON suraya_social_audience_snapshots(account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS suraya_social_segments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(80) NOT NULL DEFAULT 'operator_defined',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suraya_social_jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type VARCHAR(40) NOT NULL,
  post_id BIGINT REFERENCES suraya_social_posts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_social_jobs_ready_idx ON suraya_social_jobs(status, run_after) WHERE status='queued';

CREATE TABLE IF NOT EXISTS suraya_social_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor VARCHAR(160) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(60) NOT NULL,
  resource_id TEXT,
  outcome VARCHAR(24) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_social_audit_created_idx ON suraya_social_audit_events(created_at DESC);

CREATE TABLE IF NOT EXISTS suraya_subscription_plans (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL CHECK (monthly_price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  limits JSONB NOT NULL,
  features JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO suraya_subscription_plans(code,name,monthly_price,currency,limits,features) VALUES
('starter','شروع',0,'USD','{"connected_accounts":1,"scheduled_posts_per_month":12,"ai_drafts_per_month":30,"team_members":1,"video_minutes_per_month":0}'::jsonb,'{"content_drafts":true,"calendar":true,"basic_analytics":false,"video_studio":false,"audience_segments":false,"auto_publish":false,"live_assistant":false}'::jsonb),
('creator','سازنده',19,'USD','{"connected_accounts":3,"scheduled_posts_per_month":60,"ai_drafts_per_month":200,"team_members":1,"video_minutes_per_month":20}'::jsonb,'{"content_drafts":true,"calendar":true,"basic_analytics":true,"video_studio":true,"audience_segments":true,"auto_publish":false,"live_assistant":false}'::jsonb),
('pro','حرفه‌ای',49,'USD','{"connected_accounts":10,"scheduled_posts_per_month":300,"ai_drafts_per_month":1000,"team_members":3,"video_minutes_per_month":90}'::jsonb,'{"content_drafts":true,"calendar":true,"basic_analytics":true,"video_studio":true,"audience_segments":true,"auto_publish":true,"live_assistant":false}'::jsonb),
('agency','آژانس',149,'USD','{"connected_accounts":30,"scheduled_posts_per_month":1200,"ai_drafts_per_month":5000,"team_members":10,"video_minutes_per_month":300}'::jsonb,'{"content_drafts":true,"calendar":true,"basic_analytics":true,"video_studio":true,"audience_segments":true,"auto_publish":true,"live_assistant":true}'::jsonb)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,monthly_price=EXCLUDED.monthly_price,currency=EXCLUDED.currency,limits=EXCLUDED.limits,features=EXCLUDED.features,active=TRUE,updated_at=NOW();

CREATE TABLE IF NOT EXISTS suraya_customer_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_ref VARCHAR(180) NOT NULL,
  plan_code VARCHAR(32) NOT NULL REFERENCES suraya_subscription_plans(code),
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','past_due','cancelled','expired')),
  billing_provider VARCHAR(40),
  provider_subscription_id VARCHAR(200),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_customer_subscriptions_lookup_idx ON suraya_customer_subscriptions(customer_ref,status);


CREATE TABLE IF NOT EXISTS suraya_social_calendar_items (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  platform VARCHAR(32) NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  post_public_id TEXT REFERENCES suraya_social_posts(public_id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','drafted','ready','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_social_calendar_date_idx ON suraya_social_calendar_items(scheduled_for,status);
