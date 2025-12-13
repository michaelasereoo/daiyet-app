-- Check which days the slots are configured for
-- This will reveal if there's a day-of-week mismatch

SELECT 
  slots.day_of_week,
  CASE slots.day_of_week
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END as day_name,
  COUNT(*) as slot_count,
  MIN(slots.start_time) as earliest_start,
  MAX(slots.end_time) as latest_end,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_count
FROM availability_schedules s
JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
GROUP BY slots.day_of_week
ORDER BY slots.day_of_week;

-- Check if active column exists and its value
SELECT 
  s.id,
  s.name,
  s.is_default,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'availability_schedules' 
      AND column_name = 'active'
    ) THEN 'Column exists'
    ELSE 'Column does NOT exist'
  END as active_column_status,
  s.active  -- This will error if column doesn't exist, but that's okay
FROM availability_schedules s
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88';

-- Alternative: Check active column safely
DO $$
DECLARE
  has_active_column BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'availability_schedules' 
    AND column_name = 'active'
  ) INTO has_active_column;
  
  IF has_active_column THEN
    RAISE NOTICE 'Active column EXISTS - checking values...';
    PERFORM 1 FROM availability_schedules 
    WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88' 
    AND active = false;
    
    IF FOUND THEN
      RAISE NOTICE 'WARNING: Some schedules have active = false';
    ELSE
      RAISE NOTICE 'All schedules have active = true (or NULL)';
    END IF;
  ELSE
    RAISE NOTICE 'Active column does NOT exist - this is OK';
  END IF;
END $$;

