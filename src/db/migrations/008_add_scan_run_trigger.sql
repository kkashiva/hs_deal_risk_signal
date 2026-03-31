-- Add trigger_source column to scan_runs table
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(20) DEFAULT 'manual';

-- Comment explaining the values: 'cron', 'manual', 'test'
COMMENT ON COLUMN scan_runs.trigger_source IS 'Source of the scan trigger: cron, manual, or test';

-- Update existing records to 'manual' (default)
UPDATE scan_runs SET trigger_source = 'manual' WHERE trigger_source IS NULL;
