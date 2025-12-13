-- Migration: Add active column to availability_schedules
-- This allows dietitians to toggle all availability on/off

ALTER TABLE availability_schedules
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_availability_schedules_active ON availability_schedules(dietitian_id, active);

