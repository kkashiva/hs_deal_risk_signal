CREATE TABLE IF NOT EXISTS risk_evaluations (
  id SERIAL PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  deal_name TEXT,
  deal_amount NUMERIC,
  evaluation_date TIMESTAMPTZ DEFAULT NOW(),
  risk_level VARCHAR(10) NOT NULL,
  risk_reason VARCHAR(50),
  explanation TEXT,
  recommended_action TEXT,
  confidence INTEGER,
  escalation_target VARCHAR(20),
  model_used VARCHAR(30),
  prompt_version VARCHAR(10),
  was_lost_later BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  total_deals INTEGER,
  high_risk_count INTEGER,
  errors INTEGER,
  summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_eval_deal_id ON risk_evaluations(deal_id);
CREATE INDEX IF NOT EXISTS idx_eval_date ON risk_evaluations(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_eval_risk ON risk_evaluations(risk_level);
CREATE INDEX IF NOT EXISTS idx_scan_started ON scan_runs(started_at);
