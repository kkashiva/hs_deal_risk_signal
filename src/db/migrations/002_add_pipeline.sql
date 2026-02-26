-- Add pipeline column to risk_evaluations
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS pipeline VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_eval_pipeline ON risk_evaluations(pipeline);
