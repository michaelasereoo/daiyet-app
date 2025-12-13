-- ============================================
-- Diagnostic Queries for Dietitian UUID
-- UUID: b900e502-71a6-45da-bde6-7b596cc14d88
-- ============================================

-- 1. Basic Info
SELECT 
  id,
  name,
  email,
  role,
  created_at
FROM users
WHERE id = 'b900e502-71a6-45da-bde6-7b596cc14d88';

-- 2. Check All Schedules
SELECT 
  id,
  name,
  is_default,
  timezone,
  created_at,
  updated_at
FROM availability_schedules
WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
ORDER BY is_default DESC, created_at DESC;

-- 3. Check Schedule Slots (Detailed)
SELECT 
  s.id as schedule_id,
  s.name as schedule_name,
  s.is_default,
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
  slots.start_time,
  slots.end_time,
  slots.enabled
FROM availability_schedules s
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
ORDER BY s.is_default DESC, slots.day_of_week, slots.start_time;

-- 4. Summary - Schedule and Slot Counts
SELECT 
  COUNT(DISTINCT s.id) as total_schedules,
  COUNT(DISTINCT CASE WHEN s.is_default = true THEN s.id END) as default_schedules,
  COUNT(DISTINCT slots.id) as total_slots,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slots,
  SUM(CASE WHEN slots.enabled = false THEN 1 ELSE 0 END) as disabled_slots
FROM availability_schedules s
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88';

-- 5. Slots by Day of Week
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
  COUNT(*) as total_slots,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slots,
  MIN(slots.start_time) as earliest_start,
  MAX(slots.end_time) as latest_end
FROM availability_schedules s
JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
GROUP BY slots.day_of_week
ORDER BY slots.day_of_week;

-- 6. Check Default Schedule Details
SELECT 
  s.id,
  s.name,
  s.is_default,
  s.timezone,
  COUNT(slots.id) as slot_count,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slot_count
FROM availability_schedules s
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
  AND s.is_default = true
GROUP BY s.id, s.name, s.is_default, s.timezone;

-- 7. Check Bookings
SELECT 
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
  MIN(start_time) as earliest_booking,
  MAX(start_time) as latest_booking
FROM bookings
WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88';

-- 8. Check Out-of-Office Periods
SELECT 
  id,
  start_date,
  end_date,
  created_at
FROM out_of_office_periods
WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
  AND (end_date >= CURRENT_DATE OR end_date IS NULL)
ORDER BY start_date;

-- 9. Check Date Overrides
SELECT 
  id,
  override_date,
  is_unavailable,
  created_at
FROM availability_date_overrides
WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'
  AND override_date >= CURRENT_DATE
ORDER BY override_date;

-- 10. COMPLETE DIAGNOSTIC - All in One
SELECT 
  'User Info' as section,
  json_build_object(
    'id', u.id,
    'name', u.name,
    'email', u.email,
    'role', u.role
  ) as data
FROM users u
WHERE u.id = 'b900e502-71a6-45da-bde6-7b596cc14d88'

UNION ALL

SELECT 
  'Schedules Summary' as section,
  json_build_object(
    'total_schedules', COUNT(DISTINCT s.id),
    'default_schedules', COUNT(DISTINCT CASE WHEN s.is_default = true THEN s.id END),
    'total_slots', COUNT(DISTINCT slots.id),
    'enabled_slots', SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END)
  ) as data
FROM availability_schedules s
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88'

UNION ALL

SELECT 
  'Bookings Summary' as section,
  json_build_object(
    'total', COUNT(*),
    'confirmed', COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END),
    'pending', COUNT(CASE WHEN status = 'PENDING' THEN 1 END)
  ) as data
FROM bookings
WHERE dietitian_id = 'b900e502-71a6-45da-bde6-7b596cc14d88';

