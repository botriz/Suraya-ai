-- Suraya Digital World foundation schema (additive and idempotent).
-- No user, character, wallet, or payment records are created by this migration.

CREATE TABLE IF NOT EXISTS world_regions (
  region_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  region_type VARCHAR(40) NOT NULL CHECK (region_type IN ('continent','country','province','city','district','natural_area')),
  parent_region_id UUID REFERENCES world_regions(region_id),
  geometry JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','review','published','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS world_regions_parent_idx ON world_regions(parent_region_id);
CREATE INDEX IF NOT EXISTS world_regions_status_idx ON world_regions(lifecycle_status);

CREATE TABLE IF NOT EXISTS world_events (
  event_id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  visibility VARCHAR(16) NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','public')),
  actor_type VARCHAR(30) NOT NULL DEFAULT 'system'
    CHECK (actor_type IN ('system','human','service','character')),
  actor_ref VARCHAR(160),
  idempotency_key VARCHAR(160) UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS world_events_public_time_idx
  ON world_events(occurred_at DESC) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS world_events_type_time_idx
  ON world_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS world_environment_layers (
  layer_id BIGSERIAL PRIMARY KEY,
  region_id UUID REFERENCES world_regions(region_id),
  layer_type VARCHAR(40) NOT NULL
    CHECK (layer_type IN ('terrain','climate','water','ecology','resources','weather')),
  dataset_version VARCHAR(40) NOT NULL,
  data JSONB NOT NULL,
  source_reference TEXT,
  review_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','verified','published','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS world_environment_region_idx
  ON world_environment_layers(region_id, layer_type, created_at DESC);

CREATE TABLE IF NOT EXISTS world_schema_migrations (
  version VARCHAR(80) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO world_schema_migrations(version)
VALUES ('001_world_foundation')
ON CONFLICT (version) DO NOTHING;
