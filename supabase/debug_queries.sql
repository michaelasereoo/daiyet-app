-- Debug queries for session_requests table
-- Run these in Supabase SQL Editor

-- 1. Check ALL meal plan requests with email normalization info
SELECT 
  id,
  client_email,
  LOWER(TRIM(client_email)) as normalized_email,
  client_email = LOWER(TRIM(client_email)) as is_normalized,
  request_type,
  meal_plan_type,
  status,
  price,
  currency,
  created_at,
  dietitian_id
FROM session_requests 
WHERE request_type = 'MEAL_PLAN'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Check for email variations (case-insensitive)
SELECT DISTINCT 
  client_email,
  LOWER(TRIM(client_email)) as normalized,
  COUNT(*) as count
FROM session_requests 
WHERE request_type = 'MEAL_PLAN'
GROUP BY client_email, LOWER(TRIM(client_email))
ORDER BY count DESC;

-- 3. Check for requests with non-normalized emails
SELECT 
  id,
  client_email,
  LOWER(TRIM(client_email)) as should_be,
  request_type,
  status,
  created_at
FROM session_requests 
WHERE request_type = 'MEAL_PLAN'
  AND client_email != LOWER(TRIM(client_email))
ORDER BY created_at DESC;

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'session_requests';

-- 5. Count requests by status
SELECT 
  status,
  COUNT(*) as count
FROM session_requests
WHERE request_type = 'MEAL_PLAN'
GROUP BY status
ORDER BY count DESC;

-- 6. Recent requests with dietitian info
SELECT 
  sr.id,
  sr.client_email,
  sr.meal_plan_type,
  sr.status,
  sr.price,
  sr.currency,
  sr.created_at,
  d.name as dietitian_name,
  d.email as dietitian_email
FROM session_requests sr
LEFT JOIN users d ON sr.dietitian_id = d.id
WHERE sr.request_type = 'MEAL_PLAN'
ORDER BY sr.created_at DESC
LIMIT 10;

