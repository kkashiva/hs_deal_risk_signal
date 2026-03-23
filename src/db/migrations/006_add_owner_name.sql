-- Add owner_name column to store resolved HubSpot owner name
ALTER TABLE risk_evaluations ADD COLUMN IF NOT EXISTS owner_name TEXT;
