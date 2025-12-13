-- Migration: Add user profile fields for booking information
-- This adds age, occupation, medical condition, and monthly food budget to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS occupation TEXT,
ADD COLUMN IF NOT EXISTS medical_condition TEXT,
ADD COLUMN IF NOT EXISTS monthly_food_budget DECIMAL(10, 2);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_profile_data ON users(id) WHERE age IS NOT NULL;

