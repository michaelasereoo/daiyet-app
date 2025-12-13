-- Migration: Add user profile data to bookings table
-- This stores user's profile information at the time of booking

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS user_age INTEGER,
ADD COLUMN IF NOT EXISTS user_occupation TEXT,
ADD COLUMN IF NOT EXISTS user_medical_condition TEXT,
ADD COLUMN IF NOT EXISTS user_monthly_food_budget DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS user_complaint TEXT;

