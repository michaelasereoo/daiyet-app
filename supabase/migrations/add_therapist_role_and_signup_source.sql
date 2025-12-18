-- Migration: Add THERAPIST role and signup_source field
-- This migration adds support for therapists and tracks user signup sources

-- Step 1: Drop the existing CHECK constraint on role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add the new CHECK constraint with THERAPIST role
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('USER', 'DIETITIAN', 'ADMIN', 'THERAPIST'));

-- Step 3: Add signup_source column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'signup_source'
  ) THEN
    ALTER TABLE users ADD COLUMN signup_source TEXT;
  END IF;
END $$;

-- Step 4: Create index on signup_source for better query performance
CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);

