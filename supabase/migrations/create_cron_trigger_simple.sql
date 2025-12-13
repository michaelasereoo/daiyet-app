-- Simple version: Create cron trigger for background-worker Edge Function
-- This will automatically call the function every 5 minutes

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists (safe version)
DO $$
DECLARE
  job_exists BOOLEAN;
BEGIN
  -- Check if job exists
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'background-worker-cron'
  ) INTO job_exists;
  
  -- Only unschedule if it exists
  IF job_exists THEN
    PERFORM cron.unschedule('background-worker-cron');
    RAISE NOTICE 'Removed existing background-worker-cron job';
  END IF;
END $$;

-- Create the cron job
-- IMPORTANT: Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- Find it in: https://app.supabase.com/project/YOUR_PROJECT_REF
-- Or extract from your SUPABASE_URL: https://YOUR_PROJECT_REF.supabase.co

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

-- Verify the cron job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'background-worker-cron';

