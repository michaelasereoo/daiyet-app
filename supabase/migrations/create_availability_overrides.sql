-- Migration: Create availability date overrides tables
-- This migration:
-- 1. Creates availability_date_overrides table for specific date exceptions
-- 2. Creates availability_date_override_slots table for override time slots
-- 3. Adds indexes and constraints for performance and data integrity

-- Step 1: Create availability_date_overrides table
CREATE TABLE IF NOT EXISTS availability_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_unavailable BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Africa/Lagos',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_override_per_date UNIQUE(dietitian_id, override_date)
);

-- Step 2: Create availability_date_override_slots table
CREATE TABLE IF NOT EXISTS availability_date_override_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_id UUID NOT NULL REFERENCES availability_date_overrides(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_availability_date_overrides_dietitian_id ON availability_date_overrides(dietitian_id);
CREATE INDEX IF NOT EXISTS idx_availability_date_overrides_date ON availability_date_overrides(override_date);
CREATE INDEX IF NOT EXISTS idx_availability_date_overrides_dietitian_date ON availability_date_overrides(dietitian_id, override_date);
CREATE INDEX IF NOT EXISTS idx_availability_date_override_slots_override_id ON availability_date_override_slots(override_id);

-- Step 4: Add updated_at trigger
DROP TRIGGER IF EXISTS update_availability_date_overrides_updated_at ON availability_date_overrides;
CREATE TRIGGER update_availability_date_overrides_updated_at 
  BEFORE UPDATE ON availability_date_overrides
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Add RLS policies (if RLS is enabled)
ALTER TABLE availability_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_date_override_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Dietitians can manage their own overrides
CREATE POLICY "Dietitians can view their own overrides"
  ON availability_date_overrides FOR SELECT
  USING (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can insert their own overrides"
  ON availability_date_overrides FOR INSERT
  WITH CHECK (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can update their own overrides"
  ON availability_date_overrides FOR UPDATE
  USING (auth.uid() = dietitian_id)
  WITH CHECK (auth.uid() = dietitian_id);

CREATE POLICY "Dietitians can delete their own overrides"
  ON availability_date_overrides FOR DELETE
  USING (auth.uid() = dietitian_id);

-- Policy: Override slots are accessible through override ownership
CREATE POLICY "Dietitians can view their own override slots"
  ON availability_date_override_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM availability_date_overrides
      WHERE availability_date_overrides.id = availability_date_override_slots.override_id
      AND availability_date_overrides.dietitian_id = auth.uid()
    )
  );

CREATE POLICY "Dietitians can insert their own override slots"
  ON availability_date_override_slots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM availability_date_overrides
      WHERE availability_date_overrides.id = availability_date_override_slots.override_id
      AND availability_date_overrides.dietitian_id = auth.uid()
    )
  );

CREATE POLICY "Dietitians can update their own override slots"
  ON availability_date_override_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM availability_date_overrides
      WHERE availability_date_overrides.id = availability_date_override_slots.override_id
      AND availability_date_overrides.dietitian_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM availability_date_overrides
      WHERE availability_date_overrides.id = availability_date_override_slots.override_id
      AND availability_date_overrides.dietitian_id = auth.uid()
    )
  );

CREATE POLICY "Dietitians can delete their own override slots"
  ON availability_date_override_slots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM availability_date_overrides
      WHERE availability_date_overrides.id = availability_date_override_slots.override_id
      AND availability_date_overrides.dietitian_id = auth.uid()
    )
  );

