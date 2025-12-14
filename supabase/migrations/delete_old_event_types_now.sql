-- IMMEDIATE FIX: Delete old event types that are still showing up
-- Run this in Supabase SQL Editor RIGHT NOW to fix the issue
-- =====================================================

-- Step 1: Delete all "Free Trial Consultation" event types
-- This will cascade delete any bookings associated with these event types
DELETE FROM event_types
WHERE slug = 'free-trial-consultation' 
   OR LOWER(title) LIKE '%free trial%'
   OR LOWER(title) LIKE '%free-trial%';

-- Step 2: Delete old "1-on-1 Consultation with Licensed Dietician" event types
-- (the one WITHOUT "nutritional" in the title)
DELETE FROM event_types
WHERE slug = '1-on-1-consultation-with-licensed-dietician'
   OR (LOWER(title) LIKE '%1-on-1 consultation%' 
       AND LOWER(title) LIKE '%licensed diet%'
       AND LOWER(title) NOT LIKE '%nutritional%');

-- Step 3: Also delete any variations we might have missed
-- Delete any event type with "Free Trial" in title (case insensitive)
DELETE FROM event_types
WHERE LOWER(title) LIKE '%free%trial%'
   OR LOWER(title) LIKE '%freetrial%';

-- Step 4: Delete old consultation types that don't have "nutritional" 
-- (these are the old ones we want to remove)
DELETE FROM event_types
WHERE (LOWER(title) LIKE '%consultation%' 
       AND LOWER(title) LIKE '%licensed diet%'
       AND LOWER(title) NOT LIKE '%nutritional%'
       AND slug != '1-on-1-nutritional-counselling-and-assessment'
       AND slug != '1-on-1-nutritional-counselling-and-assessment-meal-plan');

-- Verification: Check what was deleted
SELECT 
  'Deleted event types' as status,
  COUNT(*) as count
FROM event_types
WHERE slug IN ('free-trial-consultation', '1-on-1-consultation-with-licensed-dietician')
   OR LOWER(title) LIKE '%free trial%'
   OR LOWER(title) LIKE '%free-trial%';

-- Expected: Should return 0 rows (all deleted)

-- Show remaining event types for verification
SELECT 
  id,
  user_id,
  title,
  slug,
  active,
  created_at
FROM event_types
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- After running this, refresh your book-a-call page
-- The old event types should no longer appear
-- =====================================================
