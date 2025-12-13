-- Create access_logs table for tracking access to sensitive operations
CREATE TABLE IF NOT EXISTS access_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_path ON access_logs(path);
CREATE INDEX IF NOT EXISTS idx_access_logs_method ON access_logs(method);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_access_logs_user_path ON access_logs(user_id, path, created_at DESC);

-- Add comments
COMMENT ON TABLE access_logs IS 'Logs for access to sensitive operations (admin, settings, etc.)';
COMMENT ON COLUMN access_logs.path IS 'Request path';
COMMENT ON COLUMN access_logs.method IS 'HTTP method (GET, POST, etc.)';

-- Enable RLS
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to access_logs"
  ON access_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can view their own access logs
CREATE POLICY IF NOT EXISTS "Users can view own access logs"
  ON access_logs FOR SELECT
  USING (auth.uid() = user_id);
