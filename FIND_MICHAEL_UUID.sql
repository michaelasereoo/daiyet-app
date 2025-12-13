-- Find UUID for dietitian: michaelasereoo@gmail.com
SELECT 
  id as dietitian_uuid,
  name,
  email,
  role,
  created_at,
  updated_at
FROM users
WHERE email = 'michaelasereoo@gmail.com'
  AND role = 'DIETITIAN';

-- If you want more details with availability info:
SELECT 
  u.id as dietitian_uuid,
  u.name,
  u.email,
  u.role,
  u.created_at,
  COUNT(DISTINCT s.id) as schedule_count,
  COUNT(DISTINCT CASE WHEN s.is_default = true THEN s.id END) as default_schedule_count,
  COUNT(DISTINCT slots.id) as total_slots,
  SUM(CASE WHEN slots.enabled THEN 1 ELSE 0 END) as enabled_slots
FROM users u
LEFT JOIN availability_schedules s ON u.id = s.dietitian_id
LEFT JOIN availability_schedule_slots slots ON s.id = slots.schedule_id
WHERE u.email = 'michaelasereoo@gmail.com'
  AND u.role = 'DIETITIAN'
GROUP BY u.id, u.name, u.email, u.role, u.created_at;

