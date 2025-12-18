# Troubleshooting Checklist - Session Requests Not Showing

## ✅ **What We've Fixed:**

1. ✅ Added POST handler to `/api/user/session-requests` 
2. ✅ Email normalization in API (lowercase + trim)
3. ✅ Enhanced logging in frontend and backend
4. ✅ Created database migration for email normalization trigger
5. ✅ Fixed RLS policy bug (UUID vs email comparison)
6. ✅ Added TypeScript types
7. ✅ Created debug endpoint

## 🔍 **What to Check Now:**

### Step 1: Check Browser Console
Open browser console (F12) and look for:
```
Fetched session requests: { count: X, requests: [...], rawData: {...} }
```

**What to look for:**
- `count: 0` = No requests found (check database)
- `count: > 0` = Requests found but not displaying (check rendering)
- Check `rawData` to see the actual API response

### Step 2: Check Server Terminal Logs
Look for these logs in your `npm run dev` terminal:
```
[INFO] Fetching session requests for user: <email>
[INFO] Found session requests: { count: X, normalizedEmail: "...", ... }
```

**What to look for:**
- Is the email being normalized correctly?
- How many requests were found?
- Any errors in the logs?

### Step 3: Verify Database
Run this SQL in Supabase SQL Editor:

```sql
-- Check if your meal plan requests exist
SELECT 
  id,
  client_email,
  LOWER(TRIM(client_email)) as normalized_email,
  request_type,
  meal_plan_type,
  status,
  created_at,
  dietitian_id
FROM session_requests 
WHERE request_type = 'MEAL_PLAN'
ORDER BY created_at DESC
LIMIT 10;
```

**What to check:**
- Do the requests exist?
- What is the `client_email` value?
- Is `status` = 'PENDING'?
- When were they created?

### Step 4: Check Email Match
Run this to see if emails match:

```sql
-- Check your user email vs session request emails
SELECT 
  u.id as user_id,
  u.email as user_email,
  LOWER(TRIM(u.email)) as normalized_user_email,
  sr.id as request_id,
  sr.client_email as request_email,
  LOWER(TRIM(sr.client_email)) as normalized_request_email,
  sr.status
FROM users u
LEFT JOIN session_requests sr ON LOWER(TRIM(sr.client_email)) = LOWER(TRIM(u.email))
WHERE u.email = 'michaelasereo@gmail.com'  -- Your user email
  AND sr.request_type = 'MEAL_PLAN';
```

### Step 5: Use Debug Endpoint
Visit: `http://localhost:3000/api/debug/session-requests`

This will show:
- All meal plan requests in database
- Email variations
- Your current email vs normalized

### Step 6: Test Purchase Again
After running the migrations, try purchasing again:
1. Go to `/user-dashboard/meal-plan`
2. Purchase "Test Meal Plan" (100 NGN)
3. Complete payment
4. Check console for "✅ Session request created successfully"
5. Refresh page
6. Check if it appears

## 🐛 **Common Issues:**

### Issue 1: Requests exist but count = 0
**Cause:** Email mismatch or RLS blocking
**Fix:** 
- Run email normalization migration
- Run RLS policy fix migration
- Check email casing in database

### Issue 2: Requests created but not showing
**Cause:** Status might not be "PENDING"
**Fix:** Check status in database, should be 'PENDING'

### Issue 3: API returns 200 but empty array
**Cause:** Email normalization or RLS policy
**Fix:** 
- Verify migrations ran successfully
- Check server logs for "Found session requests" count
- Use debug endpoint to see all requests

### Issue 4: POST succeeds but GET returns empty
**Cause:** Email stored differently than queried
**Fix:** 
- Run email normalization migration (fixes existing records)
- Verify trigger is active

## 📋 **Quick Verification Commands:**

```sql
-- 1. Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'session_requests'
  AND trigger_name = 'normalize_session_request_email_trigger';

-- 2. Check if requests exist with your email
SELECT COUNT(*) 
FROM session_requests 
WHERE LOWER(TRIM(client_email)) = LOWER(TRIM('michaelasereo@gmail.com'))
  AND request_type = 'MEAL_PLAN'
  AND status = 'PENDING';

-- 3. Check RLS policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'session_requests';
```

## 🎯 **Next Steps:**

1. **Check console logs** - See what count is being returned
2. **Check database** - Verify requests exist with correct email/status
3. **Run migrations** - If not already done
4. **Test purchase** - Try purchasing again after migrations
5. **Use debug endpoint** - See all requests and email variations

If requests exist in database but aren't showing, the issue is likely:
- Email casing mismatch (fixed by migration)
- RLS policy blocking (fixed by migration)
- Status not "PENDING" (check database)

