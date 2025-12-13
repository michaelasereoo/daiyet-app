-- Migration: Create availability schedules tables
-- This migration:
-- 1. Creates availability_schedules table
-- 2. Creates availability_schedule_slots table for normalized storage
-- 3. Creates function to create default working hours for dietitians
-- 4. Creates trigger to auto-create default availability when user becomes dietitian
-- 5. Creates default schedules for existing dietitians

-- Step 1: Create availability_schedules table
CREATE TABLE IF NOT EXISTS availability_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  timezone TEXT DEFAULT 'Africa/Lagos',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create availability_schedule_slots table
CREATE TABLE IF NOT EXISTS availability_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_availability_schedules_dietitian_id ON availability_schedules(dietitian_id);
CREATE INDEX IF NOT EXISTS idx_availability_schedules_is_default ON availability_schedules(dietitian_id, is_default);
CREATE INDEX IF NOT EXISTS idx_availability_schedule_slots_schedule_id ON availability_schedule_slots(schedule_id);
CREATE INDEX IF NOT EXISTS idx_availability_schedule_slots_day_enabled ON availability_schedule_slots(day_of_week, enabled);

-- Create unique partial index to ensure only one default schedule per dietitian
CREATE UNIQUE INDEX IF NOT EXISTS unique_default_per_dietitian 
ON availability_schedules(dietitian_id) 
WHERE is_default = true;

-- Step 4: Add updated_at triggers
DROP TRIGGER IF EXISTS update_availability_schedules_updated_at ON availability_schedules;
CREATE TRIGGER update_availability_schedules_updated_at BEFORE UPDATE ON availability_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_schedule_slots_updated_at ON availability_schedule_slots;
CREATE TRIGGER update_availability_schedule_slots_updated_at BEFORE UPDATE ON availability_schedule_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Create function to insert default availability for a dietitian
CREATE OR REPLACE FUNCTION create_default_availability_for_dietitian(dietitian_user_id UUID)
RETURNS VOID AS $$
DECLARE
  schedule_id UUID;
BEGIN
  -- Only proceed if the user is a dietitian and doesn't already have a default schedule
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = dietitian_user_id AND role = 'DIETITIAN'
  ) THEN
    RETURN;
  END IF;

  -- Check if default schedule already exists
  IF EXISTS (
    SELECT 1 FROM availability_schedules 
    WHERE dietitian_id = dietitian_user_id AND is_default = true
  ) THEN
    RETURN;
  END IF;

  -- Create default "Working Hours" schedule
  INSERT INTO availability_schedules (dietitian_id, name, is_default, timezone)
  VALUES (dietitian_user_id, 'Working Hours', true, 'Africa/Lagos')
  RETURNING id INTO schedule_id;

  -- Create slots for Monday through Friday, 9:00 AM to 5:00 PM
  INSERT INTO availability_schedule_slots (schedule_id, day_of_week, start_time, end_time, enabled)
  VALUES
    (schedule_id, 1, '09:00:00', '17:00:00', true), -- Monday
    (schedule_id, 2, '09:00:00', '17:00:00', true), -- Tuesday
    (schedule_id, 3, '09:00:00', '17:00:00', true), -- Wednesday
    (schedule_id, 4, '09:00:00', '17:00:00', true), -- Thursday
    (schedule_id, 5, '09:00:00', '17:00:00', true); -- Friday
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger function to auto-create default availability
CREATE OR REPLACE FUNCTION trigger_create_default_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is created with DIETITIAN role, or role is updated to DIETITIAN
  IF NEW.role = 'DIETITIAN' THEN
    PERFORM create_default_availability_for_dietitian(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create triggers
DROP TRIGGER IF EXISTS create_default_availability_on_insert ON users;
DROP TRIGGER IF EXISTS create_default_availability_on_update ON users;

CREATE TRIGGER create_default_availability_on_insert
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'DIETITIAN')
  EXECUTE FUNCTION trigger_create_default_availability();

CREATE TRIGGER create_default_availability_on_update
  AFTER UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role = 'DIETITIAN' AND (OLD.role IS NULL OR OLD.role != 'DIETITIAN'))
  EXECUTE FUNCTION trigger_create_default_availability();

-- Step 8: Create default availability for all existing dietitians
DO $$
DECLARE
  dietitian_record RECORD;
BEGIN
  FOR dietitian_record IN 
    SELECT id FROM users WHERE role = 'DIETITIAN'
  LOOP
    PERFORM create_default_availability_for_dietitian(dietitian_record.id);
  END LOOP;
END $$;

