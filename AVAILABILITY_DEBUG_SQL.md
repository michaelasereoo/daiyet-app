# Availability Debug SQL Queries

Run these queries in your Supabase SQL editor to diagnose availability issues.

## 1. Check if dietitian has ANY schedules

```sql
-- Replace YOUR_DIETITIAN_UUID with actual UUID
SELECT 
  id,
  name,
  is_default,
  active,
  timezone,
  created_at
FROM availability_schedules 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID'
ORDER BY is_default DESC, created_at DESC;
```

## 2. Check if schedules have ANY slots

```sql
SELECT 
  s.id as schedule_id,
  s.name,
  s.is_default,
  s.active,
  COUNT(slots.id) as total_slot_count,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slot_count
FROM availability_schedules s
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE s.dietitian_id = 'YOUR_DIETITIAN_UUID'
GROUP BY s.id, s.name, s.is_default, s.active
ORDER BY s.is_default DESC;
```

## 3. Check if ANY slots are enabled (detailed)

```sql
SELECT 
  s.name as schedule_name,
  s.is_default,
  s.active,
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
FROM availability_schedule_slots slots
JOIN availability_schedules s ON slots.schedule_id = s.id
WHERE s.dietitian_id = 'YOUR_DIETITIAN_UUID'
ORDER BY slots.day_of_week, slots.start_time;
```

## 4. Check bookings that might block everything

```sql
SELECT 
  COUNT(*) as booking_count,
  MIN(start_time) as earliest_booking,
  MAX(start_time) as latest_booking,
  COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed_count,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count
FROM bookings 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
  AND status IN ('PENDING', 'CONFIRMED')
  AND start_time >= NOW();
```

## 5. Check out-of-office periods

```sql
SELECT 
  id,
  start_date,
  end_date,
  created_at
FROM out_of_office_periods 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
  AND (end_date >= CURRENT_DATE OR end_date IS NULL)
ORDER BY start_date;
```

## 6. Check date overrides

```sql
SELECT 
  id,
  override_date,
  is_unavailable,
  created_at
FROM availability_date_overrides 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
  AND override_date >= CURRENT_DATE
ORDER BY override_date;
```

## 7. Quick diagnostic - All in one

```sql
-- Complete diagnostic query
WITH schedule_info AS (
  SELECT 
    s.id,
    s.name,
    s.is_default,
    s.active,
    COUNT(slots.id) as slot_count,
    SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slots
  FROM availability_schedules s
  LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
  WHERE s.dietitian_id = 'YOUR_DIETITIAN_UUID'
  GROUP BY s.id, s.name, s.is_default, s.active
)
SELECT 
  'Schedules' as check_type,
  COUNT(*) as count,
  json_agg(schedule_info.*) as details
FROM schedule_info
UNION ALL
SELECT 
  'Default Schedule' as check_type,
  COUNT(*) as count,
  json_agg(schedule_info.*) as details
FROM schedule_info
WHERE is_default = true AND active = true
UNION ALL
SELECT 
  'Active Schedules' as check_type,
  COUNT(*) as count,
  json_agg(schedule_info.*) as details
FROM schedule_info
WHERE active = true;
```

## 8. Fix: Ensure at least ONE schedule is active and default

```sql
-- Make sure a schedule exists and is active
UPDATE availability_schedules 
SET active = true, is_default = true 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
AND id = (
  SELECT id FROM availability_schedules 
  WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
  ORDER BY created_at DESC 
  LIMIT 1
);
```

## 9. Fix: Add default slots if none exist (Monday-Friday 9am-5pm)

```sql
-- Add Monday-Friday 9am-5pm slots to default schedule
INSERT INTO availability_schedule_slots (schedule_id, day_of_week, start_time, end_time, enabled)
SELECT 
  id as schedule_id,
  unnest(ARRAY[1,2,3,4,5]) as day_of_week, -- Monday-Friday (1=Monday, 5=Friday)
  '09:00:00'::time as start_time,
  '17:00:00'::time as end_time,
  true as enabled
FROM availability_schedules 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID' 
AND is_default = true
AND NOT EXISTS (
  SELECT 1 FROM availability_schedule_slots 
  WHERE schedule_id = availability_schedules.id
);
```

## 10. Fix: Check timezone consistency

```sql
-- Update all schedules to same timezone
UPDATE availability_schedules 
SET timezone = 'Africa/Lagos' 
WHERE dietitian_id = 'YOUR_DIETITIAN_UUID'
AND timezone IS NULL OR timezone != 'Africa/Lagos';
```

## 11. Day of Week Reference

**JavaScript/TypeScript**: `date.getDay()` returns:
- 0 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

**Database should store the same values (0-6)** where 0 = Sunday.

## 12. Verify day_of_week values in database

```sql
-- Check what day_of_week values are actually stored
SELECT DISTINCT 
  day_of_week,
  CASE day_of_week
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
    ELSE 'INVALID'
  END as day_name,
  COUNT(*) as count
FROM availability_schedule_slots
JOIN availability_schedules s ON availability_schedule_slots.schedule_id = s.id
WHERE s.dietitian_id = 'YOUR_DIETITIAN_UUID'
GROUP BY day_of_week
ORDER BY day_of_week;
```

