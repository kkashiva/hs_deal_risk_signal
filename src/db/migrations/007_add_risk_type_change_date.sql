-- Track when the risk_level last changed for a deal
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS risk_type_change_date TIMESTAMPTZ;
