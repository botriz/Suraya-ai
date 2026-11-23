ALTER TABLE suraya_orders
  ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS quoted_currency VARCHAR(8),
  ADD COLUMN IF NOT EXISTS operator_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE suraya_orders ALTER COLUMN quoted_currency DROP DEFAULT;
ALTER TABLE suraya_orders ALTER COLUMN quoted_currency DROP NOT NULL;
UPDATE suraya_orders SET quoted_currency = NULL WHERE quoted_amount IS NULL;

CREATE TABLE IF NOT EXISTS suraya_order_events (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL REFERENCES suraya_orders(public_id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suraya_order_events_public_id_created_idx
  ON suraya_order_events(public_id, created_at DESC);
