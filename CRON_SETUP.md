# Cron Trigger Setup Guide

## Method 1: Using Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions** → **background-worker**
2. Scroll down to **"Cron Triggers"** section
3. Click **"Add Cron Trigger"**
4. Configure:
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **HTTP Method:** `POST`
   - **Headers:**
     ```
     Authorization: Bearer daiyet-background-worker-2025-secret-abc123xyz789
     Content-Type: application/json
     ```
   - **Payload:** `{}`
5. Click **"Save"**

## Method 2: Using SQL (pg_cron extension)

### Step 1: Enable pg_cron extension

Run this in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Create the cron job

**IMPORTANT:** Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

You can find your project reference in your Supabase Dashboard URL:
- URL format: `https://app.supabase.com/project/YOUR_PROJECT_REF`
- Or in your project settings

```sql
-- Drop existing cron job if it exists
SELECT cron.unschedule('background-worker-cron');

-- Create the cron job
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
```

### Step 3: Verify the cron job

```sql
-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'background-worker-cron';

-- View all cron jobs
SELECT * FROM cron.job;
```

### Step 4: Test manually

Replace `YOUR_PROJECT_REF` with your actual project reference:

```sql
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/background-worker',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer daiyet-background-worker-2025-secret-abc123xyz789'
  ),
  body := '{}'::jsonb
);
```

## Method 3: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# The cron trigger will be managed through the dashboard
```

## Environment Variables

Make sure these are set in **Edge Functions** → **background-worker** → **Settings** → **Secrets**:

```
CRON_SECRET=daiyet-background-worker-2025-secret-abc123xyz789
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@daiyet.co
BREVO_SENDER_NAME=Daiyet
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=your_site_url
```

## Testing

### Test 1: Insert a test job

```sql
INSERT INTO scheduled_jobs (type, scheduled_for, payload)
VALUES ('test', NOW(), '{"message": "Hello from test"}');
```

### Test 2: Check function logs

1. Go to **Edge Functions** → **background-worker** → **Logs**
2. Look for execution logs every 5 minutes
3. Check for:
   - `🚀 Background Worker Started`
   - `📧 Processing email queue...`
   - `📋 Found X scheduled jobs to process`
   - `✅ Job completed successfully`

### Test 3: Verify jobs are processed

```sql
-- Check pending jobs
SELECT * FROM scheduled_jobs WHERE status = 'pending';

-- Check completed jobs
SELECT * FROM scheduled_jobs WHERE status = 'completed' ORDER BY created_at DESC LIMIT 5;

-- Check failed jobs
SELECT * FROM scheduled_jobs WHERE status = 'failed';
```

## Troubleshooting

### Cron not running?
- Check if pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Verify cron job exists: `SELECT * FROM cron.job WHERE jobname = 'background-worker-cron';`
- Check cron logs: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'background-worker-cron');`

### Function not responding?
- Verify Edge Function is deployed
- Check environment variables are set
- Review function logs for errors
- Test manually using "Invoke" button

### Authentication failing?
- Verify CRON_SECRET matches in both:
  - Edge Function environment variables
  - Cron trigger headers
- Check the Authorization header format: `Bearer daiyet-background-worker-2025-secret-abc123xyz789`

