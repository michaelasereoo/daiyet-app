-- Migration: Update existing event types to new structure
-- This migration:
-- 1. Deletes "Free Trial Consultation" event types
-- 2. Deletes old "1-on-1 Consultation with Licensed Dietician" event types
-- 3. Ensures new event types exist for all dietitians

-- Step 1: Delete all "Free Trial Consultation" event types
-- Note: This will cascade delete any bookings associated with these event types
-- Also delete by title in case slug is different
DELETE FROM event_types
WHERE slug = 'free-trial-consultation' 
   OR LOWER(title) LIKE '%free trial%'
   OR LOWER(title) LIKE '%free-trial%';

-- Step 2: Delete old "1-on-1 Consultation with Licensed Dietician" event types
-- Note: This will cascade delete any bookings associated with these event types
-- Also delete by title in case slug is different
DELETE FROM event_types
WHERE slug = '1-on-1-consultation-with-licensed-dietician'
   OR (LOWER(title) LIKE '%1-on-1 consultation%' 
       AND LOWER(title) LIKE '%licensed diet%'
       AND LOWER(title) NOT LIKE '%nutritional%');

-- Step 3: Ensure all 4 default event types exist for all dietitians
DO $$
DECLARE
  dietitian_record RECORD;
BEGIN
  FOR dietitian_record IN 
    SELECT id FROM users WHERE role = 'DIETITIAN'
  LOOP
    -- Ensure 1-on-1 Nutritional counselling and assessment exists
    INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
    SELECT 
      dietitian_record.id,
      '1-on-1 Nutritional counselling and assessment',
      '1-on-1-nutritional-counselling-and-assessment',
      'Have one on one consultation with Licensed Dietitician [Nutritional counseling and assessment]',
      45,
      15000,
      'NGN',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM event_types 
      WHERE user_id = dietitian_record.id 
      AND slug = '1-on-1-nutritional-counselling-and-assessment'
    );

    -- Ensure 1-on-1 Nutritional Counselling and Assessment + Meal Plan exists
    INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
    SELECT 
      dietitian_record.id,
      '1-on-1 Nutritional Counselling and Assessment + Meal Plan',
      '1-on-1-nutritional-counselling-and-assessment-meal-plan',
      'Comprehensive nutritional counselling and assessment session with a personalized 7-day meal plan included.',
      45,
      25000,
      'NGN',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM event_types 
      WHERE user_id = dietitian_record.id 
      AND slug = '1-on-1-nutritional-counselling-and-assessment-meal-plan'
    );

    -- Ensure Monitoring exists
    INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
    SELECT 
      dietitian_record.id,
      'Monitoring',
      'monitoring',
      'Monitoring consultation',
      20,
      5000,
      'NGN',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM event_types 
      WHERE user_id = dietitian_record.id 
      AND slug = 'monitoring'
    );

    -- Ensure Test Event exists
    INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
    SELECT 
      dietitian_record.id,
      'Test Event',
      'test-event',
      'Test event for payment testing',
      15,
      100,
      'NGN',
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM event_types 
      WHERE user_id = dietitian_record.id 
      AND slug = 'test-event'
    );
  END LOOP;
END $$;
