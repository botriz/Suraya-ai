CREATE TABLE IF NOT EXISTS suraya_manual_payments (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL REFERENCES suraya_orders(public_id) ON DELETE CASCADE,
  payer_name VARCHAR(120) NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(8) NOT NULL CHECK (currency IN ('IRR', 'IRT')),
  reference_code VARCHAR(100) NOT NULL,
  paid_at DATE NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'confirmed', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suraya_manual_payments_public_id_created_idx
  ON suraya_manual_payments(public_id, created_at DESC);

CREATE INDEX IF NOT EXISTS suraya_manual_payments_status_created_idx
  ON suraya_manual_payments(status, created_at DESC);
