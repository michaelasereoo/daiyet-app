-- Create auth_audit_log table for tracking authentication events
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  provider TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_success ON auth_audit_log(success);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_provider ON auth_audit_log(provider);

-- Add comments
COMMENT ON TABLE auth_audit_log IS 'Audit log for all authentication events';
COMMENT ON COLUMN auth_audit_log.action IS 'Action type: signin, signout, signup, password_reset, etc.';
COMMENT ON COLUMN auth_audit_log.provider IS 'OAuth provider: google, email, etc.';
COMMENT ON COLUMN auth_audit_log.success IS 'Whether the action was successful';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event metadata';

-- Enable RLS
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to auth_audit_log"
  ON auth_audit_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can view their own audit logs
CREATE POLICY IF NOT EXISTS "Users can view own audit logs"
  ON auth_audit_log FOR SELECT
  USING (auth.uid() = user_id);
