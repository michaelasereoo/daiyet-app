-- Verification Script: Check if Event Types Migration Has Been Applied
-- Run this in Supabase SQL Editor to verify the migration status
-- =====================================================

-- 1. Check if all dietitians have the 4 required event types
SELECT 
  u.id as dietitian_id,
  u.email as dietitian_email,
  u.name as dietitian_name,
  COUNT(DISTINCT et.id) as event_type_count,
  ARRAY_AGG(DISTINCT et.slug ORDER BY et.slug) as event_type_slugs
FROM users u
LEFT JOIN event_types et ON et.user_id = u.id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.email, u.name
HAVING COUNT(DISTINCT et.id) < 4
ORDER BY u.email;

-- Expected: Should return 0 rows (all dietitians should have 4 event types)

-- 2. Check for old event types that should have been deleted
SELECT 
  et.id,
  et.user_id,
  et.title,
  et.slug,
  u.email as dietitian_email
FROM event_types et
JOIN users u ON u.id = et.user_id
WHERE 
  et.slug = 'free-trial-consultation' 
  OR LOWER(et.title) LIKE '%free trial%'
  OR LOWER(et.title) LIKE '%free-trial%'
  OR (et.slug = '1-on-1-consultation-with-licensed-dietician')
  OR (LOWER(et.title) LIKE '%1-on-1 consultation%' 
      AND LOWER(et.title) LIKE '%licensed diet%'
      AND LOWER(et.title) NOT LIKE '%nutritional%');

-- Expected: Should return 0 rows (old event types should be deleted)

-- 3. Verify the 4 default event types exist for each dietitian
SELECT 
  u.id as dietitian_id,
  u.email as dietitian_email,
  CASE 
    WHEN EXISTS (SELECT 1 FROM event_types WHERE user_id = u.id AND slug = '1-on-1-nutritional-counselling-and-assessment') THEN '✓'
    ELSE '✗'
  END as has_nutritional_counselling,
  CASE 
    WHEN EXISTS (SELECT 1 FROM event_types WHERE user_id = u.id AND slug = '1-on-1-nutritional-counselling-and-assessment-meal-plan') THEN '✓'
    ELSE '✗'
  END as has_meal_plan,
  CASE 
    WHEN EXISTS (SELECT 1 FROM event_types WHERE user_id = u.id AND slug = 'monitoring') THEN '✓'
    ELSE '✗'
  END as has_monitoring,
  CASE 
    WHEN EXISTS (SELECT 1 FROM event_types WHERE user_id = u.id AND slug = 'test-event') THEN '✓'
    ELSE '✗'
  END as has_test_event
FROM users u
WHERE u.role = 'DIETITIAN'
ORDER BY u.email;

-- Expected: All columns should show '✓' for each dietitian

-- 4. Check if triggers are in place
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN (
  'create_default_event_types_on_insert',
  'create_default_event_types_on_update'
)
ORDER BY trigger_name;

-- Expected: Should return 2 rows (one for INSERT, one for UPDATE)

-- 5. Check if the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_default_event_types_for_dietitian';

-- Expected: Should return 1 row

-- 6. Check constraint on event_types table
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'event_types'
  AND constraint_name = 'event_types_user_id_slug_key';

-- Expected: Should return 1 row (composite unique constraint)

-- =====================================================
-- Summary Report
-- =====================================================
-- If all checks pass:
--   - All dietitians have 4 event types ✓
--   - Old event types are deleted ✓
--   - Triggers are in place ✓
--   - Function exists ✓
--   - Constraint is correct ✓
-- 
-- If any check fails, run the migrations:
--   1. supabase/migrations/create_default_event_types.sql
--   2. supabase/migrations/update_existing_event_types.sql
-- =====================================================
