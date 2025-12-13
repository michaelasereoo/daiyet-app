-- ============================================
-- SQL Queries to Find Dietitian UUIDs
-- ============================================

-- 1. Get ALL dietitians with their UUIDs
SELECT 
  id as dietitian_uuid,
  name,
  email,
  role,
  created_at
FROM users
WHERE role = 'DIETITIAN'
ORDER BY created_at DESC;

-- 2. Find dietitian by email
SELECT 
  id as dietitian_uuid,
  name,
  email,
  role
FROM users
WHERE email = 'dietitian@example.com'  -- Replace with actual email
  AND role = 'DIETITIAN';

-- 3. Find dietitian by name (partial match)
SELECT 
  id as dietitian_uuid,
  name,
  email,
  role
FROM users
WHERE name ILIKE '%John%'  -- Replace with actual name
  AND role = 'DIETITIAN';

-- 4. Get dietitian UUID with their availability schedules count
-- Note: If you get an error about 'active' column, run the migration: add_active_to_availability_schedules.sql
SELECT 
  u.id as dietitian_uuid,
  u.name,
  u.email,
  COUNT(DISTINCT s.id) as schedule_count,
  COUNT(DISTINCT CASE WHEN s.is_default = true THEN s.id END) as default_schedule_count
FROM users u
LEFT JOIN availability_schedules s ON u.id = s.dietitian_id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.name, u.email
ORDER BY u.created_at DESC;

-- 4b. Get dietitian UUID with active schedules (if active column exists)
-- Uncomment this if the active column migration has been run
/*
SELECT 
  u.id as dietitian_uuid,
  u.name,
  u.email,
  COUNT(DISTINCT s.id) as schedule_count,
  COUNT(DISTINCT CASE WHEN s.is_default = true THEN s.id END) as default_schedule_count,
  COUNT(DISTINCT CASE WHEN s.active = true THEN s.id END) as active_schedule_count
FROM users u
LEFT JOIN availability_schedules s ON u.id = s.dietitian_id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.name, u.email
ORDER BY u.created_at DESC;
*/

-- 5. Get dietitian UUID with complete availability info
-- Note: Removed 'active' column - add it back if migration has been run
SELECT 
  u.id as dietitian_uuid,
  u.name,
  u.email,
  s.id as schedule_id,
  s.name as schedule_name,
  s.is_default,
  COUNT(slots.id) as total_slots,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slots
FROM users u
LEFT JOIN availability_schedules s ON u.id = s.dietitian_id
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.name, u.email, s.id, s.name, s.is_default
ORDER BY u.name, s.is_default DESC;

-- 6. Quick lookup - just UUID and email
SELECT 
  id as dietitian_uuid,
  email
FROM users
WHERE role = 'DIETITIAN'
ORDER BY email;

-- 7. Find dietitian by UUID (if you have it)
SELECT 
  id as dietitian_uuid,
  name,
  email,
  role,
  created_at,
  updated_at
FROM users
WHERE id = 'YOUR_UUID_HERE'  -- Replace with actual UUID
  AND role = 'DIETITIAN';

-- 8. Get the most recently created dietitian
SELECT 
  id as dietitian_uuid,
  name,
  email,
  created_at
FROM users
WHERE role = 'DIETITIAN'
ORDER BY created_at DESC
LIMIT 1;

-- 9. Find dietitian with most bookings (active dietitian)
SELECT 
  u.id as dietitian_uuid,
  u.name,
  u.email,
  COUNT(b.id) as booking_count
FROM users u
LEFT JOIN bookings b ON u.id = b.dietitian_id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.name, u.email
ORDER BY booking_count DESC
LIMIT 10;

-- 10. Find dietitian with availability configured
-- Note: Removed 'active' filter - add 'AND s.active = true' if migration has been run
SELECT DISTINCT
  u.id as dietitian_uuid,
  u.name,
  u.email,
  COUNT(DISTINCT s.id) as schedules,
  COUNT(DISTINCT slots.id) as slots
FROM users u
JOIN availability_schedules s ON u.id = s.dietitian_id
JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE u.role = 'DIETITIAN'
  AND slots.enabled = true
GROUP BY u.id, u.name, u.email
HAVING COUNT(DISTINCT slots.id) > 0
ORDER BY u.name;

