-- Migration: Add intermediate LangGraph node output columns
-- These store the per-signal analysis from each graph node for long-term memory

ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS deal_analysis TEXT;
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS email_analysis TEXT;
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS transcript_analysis TEXT;

-- Widen prompt_version to accommodate 'v2.0-langgraph'
ALTER TABLE risk_evaluations ALTER COLUMN prompt_version TYPE VARCHAR(30);
