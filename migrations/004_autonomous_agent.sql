CREATE TABLE IF NOT EXISTS suraya_agent_tasks (
  id UUID PRIMARY KEY,
  goal TEXT NOT NULL CHECK (char_length(goal) BETWEEN 8 AND 4000),
  status VARCHAR(24) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','awaiting_ci','needs_review','failed','cancelled')),
  branch_name TEXT,
  pull_request_url TEXT,
  pull_request_number INTEGER,
  commit_sha TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS suraya_agent_tasks_queue_idx
  ON suraya_agent_tasks (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS suraya_agent_tasks_status_idx
  ON suraya_agent_tasks (status, updated_at);
