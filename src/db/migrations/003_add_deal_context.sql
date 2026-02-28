-- Add deal metadata and engagement metrics as JSONB columns
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS deal_metadata JSONB;
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS engagement_metrics JSONB;
