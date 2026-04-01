-- Track login/activity timestamps (Neon Auth handles user identity)
CREATE TABLE IF NOT EXISTS user_activity (
  user_id UUID PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
);

-- Link manual scan runs to the user who triggered them
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES neon_auth."user"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_scan_runs_user_id ON scan_runs(user_id);
