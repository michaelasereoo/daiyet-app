-- Migration: Add availability_schedule_id to event_types table
-- This allows event types to link to specific availability schedules or inherit from default

-- Add availability_schedule_id column to event_types table
ALTER TABLE event_types 
ADD COLUMN IF NOT EXISTS availability_schedule_id UUID 
REFERENCES availability_schedules(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_event_types_availability_schedule_id 
ON event_types(availability_schedule_id);

-- Add comment to explain the column
COMMENT ON COLUMN event_types.availability_schedule_id IS 
'Links event type to a specific availability schedule. If NULL, event type inherits from dietitian default schedule.';

