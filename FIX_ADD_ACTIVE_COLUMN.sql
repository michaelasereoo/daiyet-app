-- ============================================
-- Fix: Add active column to availability_schedules
-- Run this if you get errors about 'active' column not existing
-- ============================================

-- Check if column exists first
DO $$
BEGIN
  -- Add active column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'availability_schedules' 
    AND column_name = 'active'
  ) THEN
    ALTER TABLE availability_schedules
    ADD COLUMN active BOOLEAN DEFAULT true;
    
    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_availability_schedules_active 
    ON availability_schedules(dietitian_id, active);
    
    RAISE NOTICE 'Added active column to availability_schedules';
  ELSE
    RAISE NOTICE 'active column already exists';
  END IF;
END $$;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'availability_schedules'
  AND column_name = 'active';

