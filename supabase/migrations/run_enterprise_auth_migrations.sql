-- =====================================================
-- Enterprise Auth Migrations - Run All
-- =====================================================
-- This file combines all enterprise auth migrations
-- Run this in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Add Auth Enhancements to Users Table
-- =====================================================

-- Add account_status column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'ACTIVE' 
CHECK (account_status IN ('ACTIVE', 'PENDING', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION'));

-- Add last_sign_in_at column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Add email_verified boolean column (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add metadata JSONB column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing users to have ACTIVE status if null
UPDATE users 
SET account_status = 'ACTIVE' 
WHERE account_status IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_last_sign_in_at ON users(last_sign_in_at DESC);

-- Add comment to columns
COMMENT ON COLUMN users.account_status IS 'Account status: ACTIVE, PENDING, SUSPENDED, DELETED, PENDING_VERIFICATION';
COMMENT ON COLUMN users.last_sign_in_at IS 'Timestamp of last successful sign-in';
COMMENT ON COLUMN users.email_verified IS 'Whether the email address has been verified';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata stored as JSON';

-- =====================================================
-- 2. Create Auth Audit Log Table
-- =====================================================

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
DROP POLICY IF EXISTS "Service role full access to auth_audit_log" ON auth_audit_log;
CREATE POLICY "Service role full access to auth_audit_log"
  ON auth_audit_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can view their own audit logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON auth_audit_log;
CREATE POLICY "Users can view own audit logs"
  ON auth_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. Create Access Logs Table
-- =====================================================

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
DROP POLICY IF EXISTS "Service role full access to access_logs" ON access_logs;
CREATE POLICY "Service role full access to access_logs"
  ON access_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Users can view their own access logs
DROP POLICY IF EXISTS "Users can view own access logs" ON access_logs;
CREATE POLICY "Users can view own access logs"
  ON access_logs FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Update RLS Policies (Must be last)
-- =====================================================

-- Remove permissive "allow all" policies
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "Allow all operations on event_types" ON event_types;
DROP POLICY IF EXISTS "Allow all operations on bookings" ON bookings;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
DROP POLICY IF EXISTS "Allow all operations on google_oauth_tokens" ON google_oauth_tokens;

-- Users table policies
-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access to users" ON users;
CREATE POLICY "Service role full access to users"
  ON users FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create trigger function to prevent users from changing their own role or account_status
CREATE OR REPLACE FUNCTION prevent_user_role_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check if the user is updating themselves (not service role)
  IF auth.uid() = NEW.id AND auth.uid() IS NOT NULL THEN
    -- Prevent role changes
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    -- Prevent account_status changes
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
      RAISE EXCEPTION 'Users cannot change their own account status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS prevent_user_role_status_change_trigger ON users;
CREATE TRIGGER prevent_user_role_status_change_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_role_status_change();

-- Event types policies
-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access to event_types" ON event_types;
CREATE POLICY "Service role full access to event_types"
  ON event_types FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view event types
DROP POLICY IF EXISTS "Anyone can view active event types" ON event_types;
CREATE POLICY "Anyone can view active event types"
  ON event_types FOR SELECT
  USING (active = true);

-- Dietitians can manage their own event types
DROP POLICY IF EXISTS "Dietitians can manage own event types" ON event_types;
CREATE POLICY "Dietitians can manage own event types"
  ON event_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'DIETITIAN'
      AND users.id = event_types.user_id
    )
  );

-- Bookings policies
-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access to bookings" ON bookings;
CREATE POLICY "Service role full access to bookings"
  ON bookings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own bookings
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = dietitian_id);

-- Users can create bookings
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Dietitians can update bookings for their events
DROP POLICY IF EXISTS "Dietitians can update own bookings" ON bookings;
CREATE POLICY "Dietitians can update own bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM event_types
      WHERE event_types.id = bookings.event_type_id
      AND EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'DIETITIAN'
        AND users.id = event_types.user_id
      )
    )
  );

-- Payments policies
-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access to payments" ON payments;
CREATE POLICY "Service role full access to payments"
  ON payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view payments for their bookings
DROP POLICY IF EXISTS "Users can view own payment records" ON payments;
CREATE POLICY "Users can view own payment records"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = payments.booking_id
      AND (bookings.user_id = auth.uid() OR bookings.dietitian_id = auth.uid())
    )
  );

-- Google OAuth tokens policies
-- Service role can do anything
DROP POLICY IF EXISTS "Service role full access to google_oauth_tokens" ON google_oauth_tokens;
CREATE POLICY "Service role full access to google_oauth_tokens"
  ON google_oauth_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own tokens
DROP POLICY IF EXISTS "Users can view own google tokens" ON google_oauth_tokens;
CREATE POLICY "Users can view own google tokens"
  ON google_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- Migration Complete!
-- =====================================================
-- All enterprise auth migrations have been applied.
-- Your database now has:
-- ✅ Enhanced users table with account_status, last_sign_in_at, etc.
-- ✅ auth_audit_log table for tracking auth events
-- ✅ access_logs table for tracking sensitive operations
-- ✅ Updated RLS policies for better security
-- =====================================================

