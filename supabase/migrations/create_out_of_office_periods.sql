-- Migration: Create out of office periods table
-- This migration:
-- 1. Creates out_of_office_periods table for date range blocks
-- 2. Adds indexes and constraints for performance and data integrity

-- Step 1: Create out_of_office_periods table
CREATE TABLE IF NOT EXISTS out_of_office_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  notes TEXT,
  forward_to_team BOOLEAN DEFAULT false,
  forward_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_out_of_office_periods_dietitian_id ON out_of_office_periods(dietitian_id);
CREATE INDEX IF NOT EXISTS idx_out_of_office_periods_dates ON out_of_office_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_out_of_office_periods_dietitian_dates ON out_of_office_periods(dietitian_id, start_date, end_date);

-- Step 3: Add updated_at trigger
DROP TRIGGER IF EXISTS update_out_of_office_periods_updated_at ON out_of_office_periods;
CREATE TRIGGER update_out_of_office_periods_updated_at 
  BEFORE UPDATE ON out_of_office_periods
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 4: Add RLS policies (if RLS is enabled)
ALTER TABLE out_of_office_periods ENABLE ROW LEVEL SECURITY;

-- Policy: Dietitians can manage their own OOO periods
CREATE POLICY "Dietitians can view their own OOO periods"
  ON out_of_office_periods FOR SELECT
  USING (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can insert their own OOO periods"
  ON out_of_office_periods FOR INSERT
  WITH CHECK (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can update their own OOO periods"
  ON out_of_office_periods FOR UPDATE
  USING (auth.uid() = dietitian_id)
  WITH CHECK (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can delete their own OOO periods"
  ON out_of_office_periods FOR DELETE
  USING (auth.uid() = dietitian_id);

