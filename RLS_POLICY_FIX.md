# RLS Policy Fix for Session Requests

## 🔴 **Critical Issue Found**

The RLS policy "Users can view their own session requests" has a **critical bug** on line 41:

```sql
auth.uid()::text = client_email OR 
```

This compares:
- `auth.uid()` = UUID (e.g., `"af000df5-8213-4765-815b-8c896456aaf8"`)
- `client_email` = Email string (e.g., `"michaelasereo@gmail.com"`)

**This will NEVER match!** A UUID can never equal an email address.

## ✅ **The Fix**

I've created a migration file: `supabase/migrations/fix_session_requests_rls_policy.sql`

This fixes the policy to:
1. Properly compare user IDs by looking up the user by email
2. Use normalized email comparison (LOWER(TRIM()))
3. Ensure service role bypass works correctly

### Corrected Policy Logic:

```sql
-- Users can view session requests where:
-- 1. Their user ID matches the user ID associated with the client_email
auth.uid() = (SELECT id FROM users WHERE LOWER(TRIM(users.email)) = LOWER(TRIM(session_requests.client_email))) OR
-- 2. They are the dietitian for the request
auth.uid() = dietitian_id
```

## 🛡️ **Why This Matters**

Even though your API uses `createAdminClientServer()` (which uses service role and should bypass RLS), the broken policy could cause issues if:

1. **Service role key is missing** - Falls back to anon key, then RLS applies
2. **Policy evaluation order** - PostgreSQL evaluates policies in order
3. **Future client-side queries** - If you ever query from client-side, RLS will apply

## 📋 **Action Required**

### Step 1: Run the RLS Policy Fix Migration

In Supabase SQL Editor, run:
```sql
-- File: supabase/migrations/fix_session_requests_rls_policy.sql
```

This will:
- Drop the incorrect policy
- Create the corrected policy with proper user ID lookup
- Fix the INSERT policy to use normalized email
- Ensure service role bypass works

### Step 2: Verify Service Role Key

Check that `SUPABASE_SERVICE_ROLE_KEY` is set in your `.env.local`:

```bash
# Should be set
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

If missing, the admin client falls back to anon key, which would be subject to RLS.

### Step 3: Test After Fix

1. Run the migration
2. Purchase a test meal plan
3. Check if it appears in pending requests
4. Use debug endpoint: `/api/debug/session-requests`

## 🔍 **Current Policy Structure**

From your RLS policies table:

1. **"Allow all operations on session_requests"** ✅
   - Should allow service role to bypass
   - But the broken SELECT policy might interfere

2. **"Users can view their own session requests"** ❌ **BROKEN**
   - Line 41: `auth.uid()::text = client_email` - **NEVER MATCHES**
   - Line 42: Correct lookup but may not be reached if line 41 fails first

3. **"Users can create session requests"** ⚠️
   - Uses email lookup but should normalize

4. **"Dietitians can update their session requests"** ✅
   - Correctly compares UUIDs

## 🎯 **Expected Behavior After Fix**

1. **Service Role (Admin Client)**: Bypasses all RLS ✅
2. **Authenticated Users**: Can see their own requests via proper user ID lookup ✅
3. **Dietitians**: Can see requests where they are the dietitian ✅
4. **Email Normalization**: All comparisons use normalized emails ✅

## 🚨 **Immediate Impact**

The broken policy means:
- Even with service role, if there's any fallback, RLS might block access
- The policy evaluation might be inefficient
- Future client-side queries would definitely fail

**Run the migration immediately to fix this!**

