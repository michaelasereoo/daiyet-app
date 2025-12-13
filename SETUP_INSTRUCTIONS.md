# Background Worker Setup Instructions

## 1. Run Database Migrations

Run these migrations in your Supabase SQL Editor (in order):

1. **Create scheduled_jobs table:**
   ```sql
   -- File: supabase/migrations/create_scheduled_jobs.sql
   ```
   Or run directly:
   ```sql
   CREATE TABLE IF NOT EXISTS scheduled_jobs (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     type TEXT NOT NULL CHECK (type IN ('meeting_reminder', 'post_session_feedback', 'availability_check', 'test')),
     scheduled_for TIMESTAMPTZ NOT NULL,
     status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
     payload JSONB NOT NULL DEFAULT '{}'::jsonb,
     attempts INTEGER DEFAULT 0,
     max_attempts INTEGER DEFAULT 3,
     last_attempt_at TIMESTAMPTZ,
     error TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status, scheduled_for) WHERE status = 'pending';
   CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_type ON scheduled_jobs(type);
   CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);
   ```

2. **Create email_queue table:**
   ```sql
   -- File: supabase/migrations/create_email_queue.sql
   ```

3. **Create booking job triggers:**
   ```sql
   -- File: supabase/migrations/create_booking_job_triggers.sql
   ```

## 2. Deploy Edge Function

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name it: `background-worker`
4. Copy the contents of `supabase/functions/background-worker/index.ts`
5. Click "Deploy"

## 3. Configure Environment Variables

In Supabase Dashboard → Edge Functions → `background-worker` → Settings → Secrets:

Add these environment variables:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@daiyet.co
BREVO_SENDER_NAME=Daiyet
NEXT_PUBLIC_SITE_URL=https://your-domain.com
CRON_SECRET=your-secret-password-here (optional, for manual triggers)
```

## 4. Set Up Cron Trigger

1. Go to Supabase Dashboard → Edge Functions → `background-worker`
2. Scroll down to "Cron Triggers"
3. Click "Add Cron Trigger"
4. Configure:
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **HTTP Method:** `POST`
   - **Headers:**
     ```
     Authorization: Bearer your-secret-password-here
     Content-Type: application/json
     ```
   - **Payload:** `{}`
5. Click "Save"

## 5. Test the Function

### Option A: Test Immediately (Manual Invoke)

1. In Supabase Dashboard → Edge Functions → `background-worker`
2. Click "Invoke" button
3. Check the logs for output

### Option B: Test with a Test Job

Run this SQL in Supabase SQL Editor:

```sql
-- Insert a test job that runs immediately
INSERT INTO scheduled_jobs (type, scheduled_for, payload)
VALUES ('test', NOW(), '{"message": "Hello from test"}');
```

Then wait up to 5 minutes for the cron to run, or manually invoke the function.

### Option C: Test Email Queue

Run this SQL to add a test email:

```sql
INSERT INTO email_queue (type, payload, scheduled_for, status)
VALUES (
  'email',
  '{"to": "test@example.com", "subject": "Test Email", "template": "booking_confirmation", "data": {"userName": "Test User", "eventTitle": "Test Event", "date": "2024-01-01", "time": "10:00 AM", "meetingLink": "https://meet.google.com/test"}}'::jsonb,
  NOW(),
  'pending'
);
```

## 6. Verify It's Working

Check the function logs:
1. Go to Supabase Dashboard → Edge Functions → `background-worker`
2. Click "Logs" tab
3. Look for:
   - `🚀 Background Worker Started`
   - `📧 Processing email queue...`
   - `📋 Found X scheduled jobs to process`
   - `✅ Job completed successfully`

## 7. Monitor Jobs

Query the database to see job status:

```sql
-- View pending jobs
SELECT * FROM scheduled_jobs WHERE status = 'pending' ORDER BY scheduled_for;

-- View completed jobs
SELECT * FROM scheduled_jobs WHERE status = 'completed' ORDER BY created_at DESC LIMIT 10;

-- View failed jobs
SELECT * FROM scheduled_jobs WHERE status = 'failed' ORDER BY created_at DESC;
```

## Troubleshooting

### Jobs not processing?
- Check cron trigger is enabled
- Verify environment variables are set
- Check function logs for errors
- Ensure `scheduled_for` is in the past

### Emails not sending?
- Verify `BREVO_API_KEY` is correct
- Check Brevo dashboard for API usage
- Look for errors in function logs
- Check `email_dead_letter_queue` table for failed emails

### Function not deploying?
- Check syntax errors in the code
- Verify all imports are correct
- Ensure Deno runtime is selected

