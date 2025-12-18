-- Migration: Create meal-plans storage bucket
-- This bucket stores PDF meal plan files uploaded by dietitians
-- 
-- NOTE: This SQL file documents the bucket setup, but storage buckets
-- must be created through the Supabase Dashboard or Storage API.
--
-- To create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New bucket"
-- 3. Name: "meal-plans"
-- 4. Public: Yes (or configure RLS policies)
-- 5. File size limit: 10MB (or as needed)
-- 6. Allowed MIME types: application/pdf
--
-- Or use the Supabase CLI:
-- supabase storage create meal-plans --public

-- Storage bucket policies (if bucket is private, use RLS policies)
-- These policies allow dietitians to upload and users to download their meal plans

-- Policy: Dietitians can upload meal plans
-- CREATE POLICY "Dietitians can upload meal plans"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'meal-plans' AND
--   auth.uid() IN (SELECT id FROM users WHERE role = 'DIETITIAN')
-- );

-- Policy: Dietitians can view their uploaded meal plans
-- CREATE POLICY "Dietitians can view their meal plans"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'meal-plans' AND
--   auth.uid() IN (SELECT id FROM users WHERE role = 'DIETITIAN')
-- );

-- Policy: Users can view meal plans sent to them
-- CREATE POLICY "Users can view their meal plans"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (
--   bucket_id = 'meal-plans' AND
--   (storage.foldername(name))[1] IN (
--     SELECT dietitian_id::text FROM meal_plans WHERE user_id = auth.uid()
--   )
-- );

