-- Reset session requests that were approved without valid PDFs
-- This migration ensures that meal plan requests are only approved if they have a valid PDF file URL

-- First, find all APPROVED meal plan requests that don't have a valid PDF
-- and reset them back to PENDING
UPDATE session_requests sr
SET status = 'PENDING'
WHERE sr.request_type = 'MEAL_PLAN'
  AND sr.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1
    FROM meal_plans mp
    WHERE mp.session_request_id = sr.id
      AND mp.file_url IS NOT NULL
      AND mp.file_url != ''
      AND (mp.file_url LIKE 'http://%' OR mp.file_url LIKE 'https://%')
  );

-- Also ensure meal_plans without valid file_urls are marked appropriately
-- (though they should already be created with status 'SENT', we can verify)
UPDATE meal_plans
SET status = 'PENDING'
WHERE file_url IS NULL
   OR file_url = ''
   OR (file_url NOT LIKE 'http://%' AND file_url NOT LIKE 'https://%');

-- Log the changes
DO $$
DECLARE
  reset_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reset_count
  FROM session_requests
  WHERE request_type = 'MEAL_PLAN'
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1
      FROM meal_plans
      WHERE meal_plans.session_request_id = session_requests.id
        AND (meal_plans.file_url IS NULL 
             OR meal_plans.file_url = ''
             OR (meal_plans.file_url NOT LIKE 'http://%' AND meal_plans.file_url NOT LIKE 'https://%'))
    );
  
  RAISE NOTICE 'Reset % meal plan requests to PENDING (no valid PDF)', reset_count;
END $$;

