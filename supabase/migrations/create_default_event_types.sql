-- Migration: Create default event types for all dietitians
-- This migration:
-- 1. Fixes slug uniqueness constraint (per user instead of global)
-- 2. Creates default event types for existing dietitians
-- 3. Sets up trigger to auto-create event types for new dietitians

-- Step 1: Fix slug uniqueness constraint
-- Drop the existing global UNIQUE constraint on slug
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_types_slug_key'
  ) THEN
    ALTER TABLE event_types DROP CONSTRAINT event_types_slug_key;
  END IF;
END $$;

-- Add composite unique constraint (slug unique per user)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_types_user_id_slug_key'
  ) THEN
    ALTER TABLE event_types ADD CONSTRAINT event_types_user_id_slug_key UNIQUE (user_id, slug);
  END IF;
END $$;

-- Step 2: Create function to insert default event types for a dietitian
CREATE OR REPLACE FUNCTION create_default_event_types_for_dietitian(dietitian_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only proceed if the user is a dietitian and doesn't already have event types
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = dietitian_user_id AND role = 'DIETITIAN'
  ) THEN
    RETURN;
  END IF;

  -- Insert Free Trial Consultation (if it doesn't exist)
  INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
  SELECT 
    dietitian_user_id,
    'Free Trial Consultation',
    'free-trial-consultation',
    'Get insights into why you need to see a dietician.',
    15,
    0,
    'NGN',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM event_types 
    WHERE user_id = dietitian_user_id 
    AND slug = 'free-trial-consultation'
  );

  -- Insert 1-on-1 Consultation with Licensed Dietician (if it doesn't exist)
  INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
  SELECT 
    dietitian_user_id,
    '1-on-1 Consultation with Licensed Dietician',
    '1-on-1-consultation-with-licensed-dietician',
    'Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]',
    45,
    15000,
    'NGN',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM event_types 
    WHERE user_id = dietitian_user_id 
    AND slug = '1-on-1-consultation-with-licensed-dietician'
  );

  -- Insert Monitoring (if it doesn't exist)
  INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
  SELECT 
    dietitian_user_id,
    'Monitoring',
    'monitoring',
    'Monitoring consultation',
    20,
    5000,
    'NGN',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM event_types 
    WHERE user_id = dietitian_user_id 
    AND slug = 'monitoring'
  );

  -- Insert Test Event (if it doesn't exist)
  INSERT INTO event_types (user_id, title, slug, description, length, price, currency, active)
  SELECT 
    dietitian_user_id,
    'Test Event',
    'test-event',
    'Test event for payment testing',
    15,
    100,
    'NGN',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM event_types 
    WHERE user_id = dietitian_user_id 
    AND slug = 'test-event'
  );
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create default event types for all existing dietitians
DO $$
DECLARE
  dietitian_record RECORD;
BEGIN
  FOR dietitian_record IN 
    SELECT id FROM users WHERE role = 'DIETITIAN'
  LOOP
    PERFORM create_default_event_types_for_dietitian(dietitian_record.id);
  END LOOP;
END $$;

-- Step 4: Create trigger function to auto-create event types when a user becomes a dietitian
CREATE OR REPLACE FUNCTION trigger_create_default_event_types()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is created with DIETITIAN role, or role is updated to DIETITIAN
  IF NEW.role = 'DIETITIAN' THEN
    PERFORM create_default_event_types_for_dietitian(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS create_default_event_types_on_insert ON users;
DROP TRIGGER IF EXISTS create_default_event_types_on_update ON users;

-- Create trigger for new users
CREATE TRIGGER create_default_event_types_on_insert
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role = 'DIETITIAN')
  EXECUTE FUNCTION trigger_create_default_event_types();

-- Create trigger for role updates
CREATE TRIGGER create_default_event_types_on_update
  AFTER UPDATE OF role ON users
  FOR EACH ROW
  WHEN (NEW.role = 'DIETITIAN' AND (OLD.role IS NULL OR OLD.role != 'DIETITIAN'))
  EXECUTE FUNCTION trigger_create_default_event_types();
