-- Create cron trigger for background-worker Edge Function
-- This will automatically call the function every 5 minutes

-- Note: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- You can find this in your Supabase Dashboard URL: https://app.supabase.com/project/YOUR_PROJECT_REF

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists (with error handling)
DO $$
BEGIN
  -- Try to unschedule the job, but don't fail if it doesn't exist
  PERFORM cron.unschedule('background-worker-cron');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist, which is fine
    RAISE NOTICE 'Job background-worker-cron does not exist, creating new one';
END $$;

-- Create the cron job
-- Schedule: */5 * * * * means every 5 minutes
-- Replace YOUR_PROJECT_REF with your actual project reference
-- You can find this in your Supabase Dashboard URL: https://app.supabase.com/project/YOUR_PROJECT_REF
SELECT cron.schedule(
  'background-worker-cron',                    -- Job name
  '*/5 * * * *',                              -- Schedule: every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/background-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer daiyet-background-worker-2025-secret-abc123xyz789'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Alternative method using Supabase's built-in cron (if pg_cron is not available)
-- This is set up in the Supabase Dashboard instead:
-- 1. Go to Edge Functions → background-worker
-- 2. Scroll to "Cron Triggers"
-- 3. Add trigger with:
--    - Schedule: */5 * * * *
--    - Method: POST
--    - Headers: Authorization: Bearer daiyet-background-worker-2025-secret-abc123xyz789
--    - Payload: {}

-- To verify the cron job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'background-worker-cron';

-- To manually test the function (replace YOUR_PROJECT_REF):
-- SELECT net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/background-worker',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer daiyet-background-worker-2025-secret-abc123xyz789'
--   ),
--   body := '{}'::jsonb
-- );

