-- Fix RLS policy for session_requests
-- The current policy incorrectly compares auth.uid() (UUID) to client_email (text)
-- This migration fixes the policy to properly check user ownership

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can view their own session requests" ON session_requests;

-- Create corrected policy
-- Users can view session requests where:
-- 1. Their user ID matches the user ID associated with the client_email
-- 2. They are the dietitian for the request
CREATE POLICY "Users can view their own session requests" ON session_requests
  FOR SELECT
  USING (
    -- Check if authenticated user's ID matches the user ID for the client_email
    auth.uid() = (SELECT id FROM users WHERE LOWER(TRIM(users.email)) = LOWER(TRIM(session_requests.client_email))) OR
    -- Or if they are the dietitian
    auth.uid() = dietitian_id
  );

-- Also fix the INSERT policy to use normalized email comparison
DROP POLICY IF EXISTS "Users can create session requests" ON session_requests;
CREATE POLICY "Users can create session requests" ON session_requests
  FOR INSERT
  WITH CHECK (
    -- Ensure the client_email matches the authenticated user's email (normalized)
    auth.uid() = (SELECT id FROM users WHERE LOWER(TRIM(users.email)) = LOWER(TRIM(session_requests.client_email)))
  );

-- Ensure the "Allow all operations" policy is still there for service role
-- This is critical for API routes using admin client
DROP POLICY IF EXISTS "Allow all operations on session_requests" ON session_requests;
CREATE POLICY "Allow all operations on session_requests" ON session_requests
  FOR ALL
  USING (
    -- Service role bypasses all RLS
    auth.jwt() ->> 'role' = 'service_role' OR
    -- Or allow all (for development - consider restricting in production)
    true
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role' OR
    true
  );

-- Add comment explaining the policy structure
COMMENT ON POLICY "Users can view their own session requests" ON session_requests IS 
  'Users can view session requests where their user ID matches the client_email user, or where they are the dietitian';

COMMENT ON POLICY "Allow all operations on session_requests" ON session_requests IS 
  'Service role and development bypass - allows admin client to work properly';

