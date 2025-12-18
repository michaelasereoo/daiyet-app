-- Check session requests in database
SELECT 
  id,
  request_type,
  client_email,
  client_name,
  meal_plan_type,
  status,
  price,
  currency,
  created_at,
  dietitian_id
FROM session_requests
WHERE request_type = 'MEAL_PLAN'
ORDER BY created_at DESC
LIMIT 10;
