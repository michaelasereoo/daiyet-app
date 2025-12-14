-- Migration: Permanently Delete All Old Event Types
-- This migration permanently deletes all deprecated/old event types from the database
-- Associated bookings will be automatically deleted due to CASCADE constraint
-- =====================================================

-- Step 1: Delete all event types with old slugs
-- These are the exact slugs that should be deleted
DELETE FROM event_types
WHERE slug IN (
  'free-trial-consultation',
  '1-on-1-consultation-with-licensed-dietician',
  'free-trial',
  'freetrial'
);

-- Step 2: Delete all event types with "Free Trial" in the title (case insensitive)
-- This catches any variations we might have missed
DELETE FROM event_types
WHERE LOWER(title) LIKE '%free trial%'
   OR LOWER(title) LIKE '%free-trial%'
   OR LOWER(title) LIKE '%freetrial%'
   OR (LOWER(title) LIKE '%free%' AND LOWER(title) LIKE '%trial%');

-- Step 3: Delete old consultation types that don't have "nutritional" in the title
-- These are the old consultation types we want to remove
-- Keep only the new ones with "nutritional" in the title
DELETE FROM event_types
WHERE (LOWER(title) LIKE '%consultation%' 
       AND LOWER(title) LIKE '%licensed diet%'
       AND LOWER(title) NOT LIKE '%nutritional%'
       AND slug != '1-on-1-nutritional-counselling-and-assessment'
       AND slug != '1-on-1-nutritional-counselling-and-assessment-meal-plan');

-- Step 4: Delete any event types with "1-on-1 consultation" that don't have "nutritional"
-- This is a more specific check for the old consultation format
DELETE FROM event_types
WHERE (LOWER(title) LIKE '%1-on-1%' 
       AND LOWER(title) LIKE '%consultation%'
       AND LOWER(title) LIKE '%licensed diet%'
       AND LOWER(title) NOT LIKE '%nutritional%'
       AND slug != '1-on-1-nutritional-counselling-and-assessment'
       AND slug != '1-on-1-nutritional-counselling-and-assessment-meal-plan');

-- Verification: Check if any old event types still exist
-- This query should return 0 rows after the migration
SELECT 
  'Old event types still remaining' as status,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT slug) as remaining_slugs,
  ARRAY_AGG(DISTINCT title) as remaining_titles
FROM event_types
WHERE slug IN (
  'free-trial-consultation',
  '1-on-1-consultation-with-licensed-dietician',
  'free-trial',
  'freetrial'
)
OR LOWER(title) LIKE '%free trial%'
OR LOWER(title) LIKE '%free-trial%'
OR LOWER(title) LIKE '%freetrial%'
OR (LOWER(title) LIKE '%consultation%' 
    AND LOWER(title) LIKE '%licensed diet%'
    AND LOWER(title) NOT LIKE '%nutritional%'
    AND slug != '1-on-1-nutritional-counselling-and-assessment'
    AND slug != '1-on-1-nutritional-counselling-and-assessment-meal-plan');

-- Expected result: count should be 0 (all old event types deleted)

-- Show summary of remaining event types (should only show the 4 allowed types)
SELECT 
  u.email as dietitian_email,
  COUNT(*) as event_type_count,
  ARRAY_AGG(et.slug ORDER BY et.slug) as event_type_slugs,
  ARRAY_AGG(et.title ORDER BY et.slug) as event_type_titles
FROM event_types et
JOIN users u ON u.id = et.user_id
WHERE u.role = 'DIETITIAN'
GROUP BY u.id, u.email
ORDER BY u.email;

-- Expected: Each dietitian should have exactly 4 event types with slugs:
-- - '1-on-1-nutritional-counselling-and-assessment'
-- - '1-on-1-nutritional-counselling-and-assessment-meal-plan'
-- - 'monitoring'
-- - 'test-event'

-- =====================================================
-- Migration Complete
-- All old event types have been permanently deleted
-- Associated bookings have been automatically deleted (CASCADE)
-- =====================================================
