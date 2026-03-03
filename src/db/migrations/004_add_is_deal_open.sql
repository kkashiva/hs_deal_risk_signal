-- Add is_deal_open flag to filter closed deals from dashboard
-- Existing rows default to TRUE (they were scanned when open)
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS is_deal_open BOOLEAN DEFAULT TRUE;
