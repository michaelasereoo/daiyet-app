-- Migration: Create meal_plans table for storing sent meal plans
-- This table stores meal plans that have been sent to users

-- Drop table if it exists to ensure clean migration
DROP TABLE IF EXISTS meal_plans CASCADE;

CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_request_id UUID REFERENCES session_requests(id) ON DELETE SET NULL,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meal_plans_dietitian_id ON meal_plans(dietitian_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_session_request_id ON meal_plans(session_request_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_status ON meal_plans(status);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_meal_plans_updated_at ON meal_plans;
CREATE TRIGGER update_meal_plans_updated_at 
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotent migration)
DROP POLICY IF EXISTS "Dietitians can view their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Dietitians can insert their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Dietitians can update their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Dietitians can delete their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can view their own meal plans" ON meal_plans;

-- RLS Policies
-- Dietitians can view their own meal plans
CREATE POLICY "Dietitians can view their own meal plans"
  ON meal_plans FOR SELECT
  USING (auth.uid() = dietitian_id);

-- Dietitians can insert their own meal plans
CREATE POLICY "Dietitians can insert their own meal plans"
  ON meal_plans FOR INSERT
  WITH CHECK (auth.uid() = dietitian_id);

-- Dietitians can update their own meal plans
CREATE POLICY "Dietitians can update their own meal plans"
  ON meal_plans FOR UPDATE
  USING (auth.uid() = dietitian_id)
  WITH CHECK (auth.uid() = dietitian_id);

-- Dietitians can delete their own meal plans
CREATE POLICY "Dietitians can delete their own meal plans"
  ON meal_plans FOR DELETE
  USING (auth.uid() = dietitian_id);

-- Users can view meal plans sent to them
CREATE POLICY "Users can view their own meal plans"
  ON meal_plans FOR SELECT
  USING (auth.uid() = user_id);

