# Pre-Booking Test Checklist

## ✅ Required Migrations (Run in Supabase SQL Editor)

Run these migrations **in order**:

1. **Core Tables** (if not already run):
   - `supabase/schema.sql` - Creates users, event_types, bookings, payments tables
   - `supabase/migrations/add_meeting_link_and_google_tokens.sql` - Adds meeting_link column

2. **Availability System**:
   - `supabase/migrations/create_availability_schedules.sql` - Availability schedules
   - `supabase/migrations/add_active_to_availability_schedules.sql` - Active flag
   - `supabase/migrations/add_availability_to_event_types.sql` - Link event types to schedules

3. **User Profile Fields**:
   - `supabase/migrations/add_user_profile_fields.sql` - Age, occupation, etc.
   - `supabase/migrations/add_booking_profile_data.sql` - Booking profile fields

4. **Email & Jobs System** (NEW - Required):
   - `supabase/migrations/create_email_queue.sql` - Email queue table
   - `supabase/migrations/create_scheduled_jobs.sql` - Scheduled jobs table
   - `supabase/migrations/create_booking_job_triggers.sql` - Auto-schedule reminders/feedback

5. **Optional** (for cron trigger):
   - `supabase/migrations/create_cron_trigger.sql` - OR use Supabase Dashboard method

## ✅ Edge Function Setup

1. **Deploy Edge Function**:
   - Go to Supabase Dashboard → Edge Functions
   - Create/Update function: `background-worker`
   - Copy contents from: `supabase/functions/background-worker/index.ts`
   - Click "Deploy"

2. **Set Environment Variables** (Edge Functions → background-worker → Settings → Secrets):
   ```
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   BREVO_API_KEY=your_brevo_api_key_here
   BREVO_SENDER_EMAIL=noreply@daiyet.co
   BREVO_SENDER_NAME=Daiyet
   NEXT_PUBLIC_SITE_URL=your_site_url
   CRON_SECRET=daiyet-background-worker-2025-secret-abc123xyz789
   ```

3. **Configure Cron Trigger** (Optional - can test manually):
   - Method 1: Supabase Dashboard → Edge Functions → background-worker → Cron Triggers
     - Schedule: `*/5 * * * *`
     - Method: POST
     - Headers: `Authorization: Bearer daiyet-background-worker-2025-secret-abc123xyz789`
   - Method 2: Run `supabase/migrations/create_cron_trigger.sql` (replace YOUR_PROJECT_REF)

## ✅ Environment Variables (Next.js App)

Add to `.env.local`:
```
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@daiyet.co
BREVO_SENDER_NAME=Daiyet
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=your_site_url
```

## ✅ Verify Database Tables Exist

Run this SQL to check:

```sql
-- Check all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users',
  'event_types',
  'bookings',
  'payments',
  'availability_schedules',
  'availability_schedule_slots',
  'email_queue',
  'scheduled_jobs',
  'session_requests',
  'meal_plans'
)
ORDER BY table_name;
```

## ✅ Verify Data Setup

1. **Dietitian Account**:
   - Ensure you have a dietitian user in the `users` table with `role = 'DIETITIAN'`
   - Check: `SELECT * FROM users WHERE role = 'DIETITIAN';`

2. **Event Types**:
   - Ensure event types exist for the dietitian
   - Check: `SELECT * FROM event_types WHERE user_id = 'dietitian_id';`

3. **Availability Schedule**:
   - Ensure default availability schedule exists
   - Check: `SELECT * FROM availability_schedules WHERE dietitian_id = 'dietitian_id';`

## ✅ Test Flow

1. **User Dashboard**:
   - Go to `/user-dashboard/book-a-call`
   - Select dietitian
   - Select event type (Free Trial or 1-on-1)
   - Fill in form (name, email, age, occupation, medical condition, food budget, complaint)
   - Select date and time slot
   - Proceed to payment

2. **Payment**:
   - Complete Paystack payment
   - Verify webhook processes payment
   - Check booking is created with status "CONFIRMED"

3. **Verify**:
   - Booking created: `SELECT * FROM bookings ORDER BY created_at DESC LIMIT 1;`
   - Payment recorded: `SELECT * FROM payments ORDER BY created_at DESC LIMIT 1;`
   - Scheduled jobs created: `SELECT * FROM scheduled_jobs WHERE payload->>'booking_id' = 'booking_id';`
   - Email queued: `SELECT * FROM email_queue WHERE payload->>'to' = 'user_email';`

## ⚠️ Common Issues

1. **"Table does not exist"**:
   - Run missing migrations

2. **"Email not sending"**:
   - Check BREVO_API_KEY is set correctly
   - Verify email queue is being processed (check Edge Function logs)

3. **"No availability showing"**:
   - Ensure availability schedule is active
   - Check `active = true` in availability_schedules
   - Verify timeslots API is working

4. **"Payment webhook not working"**:
   - Check Paystack webhook URL is correct
   - Verify webhook secret matches
   - Check webhook logs in Paystack dashboard

## 🚀 Ready to Test?

Once all checkboxes above are complete, you're ready to test the booking flow!

