# Internal Server Error - Diagnostic Report

## 🔍 Issue Summary
The application is showing a **500 Internal Server Error** in the browser. This document provides a comprehensive analysis for your senior developer.

## 📍 Where the Error is Occurring

Based on code analysis, the error is most likely happening in one of these locations:

### 1. **Middleware** (`middleware.ts`)
- **Line 84-94**: When creating admin client fails
- **Line 96-111**: When fetching user from database fails
- **Line 164-177**: When logging access fails

### 2. **Auth Callback Route** (`app/auth/callback/route.ts`)
- **Line 84-93**: Admin client creation failure
- **Line 100-125**: Session exchange failure
- **Line 137-195**: Database user operations failure

### 3. **API Routes**
- Dashboard stats API (`app/api/dashboard/stats/route.ts`)
- Other protected API routes that require database access

## 🔴 ROOT CAUSE ANALYSIS

### **Environment Variables Status** ✅
The `.env.local` file **DOES contain** Supabase configuration:

**Found in .env.local:**
- ✅ DATABASE_URL
- ✅ NEXTAUTH_SECRET
- ✅ NEXTAUTH_URL
- ✅ NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
- ✅ PAYSTACK_SECRET_KEY
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - **PRESENT**
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - **PRESENT**
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - **PRESENT**

### **Actual Issue** 🔍
Since environment variables are present, the 500 error is likely caused by:

1. **Server needs restart** - Environment variables loaded at startup
2. **Database connection failure** - Tables might not exist or connection issue
3. **Import/module error** - Error in health route or Supabase client initialization
4. **Table missing** - `users`, `auth_audit_log`, or `access_logs` tables don't exist

**Impact**: Health endpoint returns 500, which suggests:
- The error is caught at the top-level try-catch
- Likely happening during import or database connection
**Impact**: Admin operations fail, causing 500 errors when:
- Middleware tries to fetch user data
- Auth callback tries to create/update users
- Any route tries to use admin client

**Check**: Run this in terminal:
```bash
cd /Users/macbook/Desktop/daiyet-app
echo $SUPABASE_SERVICE_ROLE_KEY
# Or check .env.local file
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY
```

### 2. **Database Connection Issues**
- Supabase URL incorrect
- Network connectivity issues
- Database tables missing (users, auth_audit_log, access_logs)

### 3. **Missing Database Tables**
The code expects these tables:
- `users`
- `auth_audit_log`
- `access_logs`

If these don't exist, operations will fail.

## 🧪 How to Diagnose

### Step 1: Check Health Endpoint
Navigate to: `http://localhost:3000/api/health`

This endpoint will show:
- ✅ Environment variables status
- ✅ Database connection status
- ✅ Table existence checks

**Expected Response:**
```json
{
  "timestamp": "2024-...",
  "status": "ok",
  "checks": {
    "env": {
      "NEXT_PUBLIC_SUPABASE_URL": true,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY": true,
      "SUPABASE_SERVICE_ROLE_KEY": true
    },
    "database": {
      "connected": true,
      "error": null
    },
    "tables": {
      "users": true,
      "auth_audit_log": true,
      "access_logs": true
    }
  }
}
```

### Step 2: Check Server Logs
Look at the terminal where `npm run dev` is running. Look for:
- `CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set!`
- `MiddlewareAdminClientError`
- `AuthCallbackAdminClientError`
- `MiddlewareUserFetchError`
- Database connection errors

### Step 3: Check Browser Console
Open browser DevTools (F12) and check:
- **Console tab**: For client-side errors
- **Network tab**: For failed requests (status 500)
  - Click on failed request
  - Check "Response" tab for error details
  - Check "Headers" tab for request details

### Step 4: Check Environment Variables
```bash
# In project root
cat .env.local

# Should contain:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # CRITICAL!
```

## 🛠️ Quick Fixes

### Fix 1: Restart Development Server (TRY THIS FIRST)

Environment variables are already in `.env.local`, but Next.js loads them at startup.

**Steps:**
1. **Stop the current dev server** (Ctrl+C in the terminal running `npm run dev`)
2. **Restart the server:**
   ```bash
   npm run dev
   ```
3. **Wait for server to fully start** (look for "Ready" message)
4. **Test the health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   # Should return JSON, not "Internal Server Error"
   ```

If still failing after restart, proceed to Fix 2.

### Fix 2: Check Database Tables Exist

### Fix 2: Verify Database Tables Exist
Run this SQL in Supabase SQL Editor:
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'auth_audit_log', 'access_logs');
```

If tables are missing, run the migrations:
```bash
# Check migration files
ls supabase/migrations/

# Run migrations (if using Supabase CLI)
supabase db reset
# Or manually run the SQL files in Supabase Dashboard
```

### Fix 3: Check Supabase Connection
1. Verify Supabase URL is correct
2. Check if project is active (not paused)
3. Verify network connectivity

## 📊 Error Flow Diagram

```
User Request
    ↓
Middleware (middleware.ts)
    ↓
createAdminClientServer() ← [FAILS IF NO SERVICE_ROLE_KEY]
    ↓
supabaseAdmin.from("users").select() ← [FAILS IF NO CONNECTION/TABLES]
    ↓
500 Internal Server Error
```

## 🔍 Specific Error Scenarios

### Scenario 1: Missing Service Role Key
**Error in logs:**
```
CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set! Admin operations will fail.
MiddlewareAdminClientError: { error: "...", timestamp: "..." }
```

**Fix:** Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`

### Scenario 2: Database Table Missing
**Error in logs:**
```
MiddlewareUserFetchError: { 
  userId: "...", 
  error: "relation \"users\" does not exist",
  timestamp: "..."
}
```

**Fix:** Run database migrations

### Scenario 3: Network/Database Connection
**Error in logs:**
```
database: {
  connected: false,
  error: "Connection timeout" or "Network error"
}
```

**Fix:** Check Supabase project status and network

## 📝 For Your Senior Developer

### Key Files to Review:
1. `lib/supabase/server.ts` (Line 68-95) - Admin client creation
2. `middleware.ts` (Line 82-111) - User fetching logic
3. `app/auth/callback/route.ts` (Line 82-195) - Auth flow
4. `.env.local` - Environment configuration

### Code Patterns to Check:
- All places using `createAdminClientServer()`
- All database queries using `supabaseAdmin.from()`
- Error handling in middleware and routes

### Recommended Next Steps:
1. ✅ Check `/api/health` endpoint response
2. ✅ Verify all environment variables are set
3. ✅ Check server logs for specific error messages
4. ✅ Verify database tables exist
5. ✅ Test with a simple API route that uses admin client

## 🎯 Testing After Fix

1. **Test Health Endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Test Homepage:**
   - Navigate to `http://localhost:3000`
   - Should load without errors

3. **Test Protected Route:**
   - Try accessing `/dashboard` (will redirect if not logged in)
   - Should redirect to login, not show 500 error

4. **Test Auth Flow:**
   - Try logging in
   - Check if callback works without 500 error

## 📞 Additional Debugging

If the issue persists, collect:
1. Full server logs from terminal
2. Browser Network tab screenshot (showing failed request)
3. Response from `/api/health` endpoint
4. Contents of `.env.local` (redact sensitive keys)
5. Supabase project status

---

**Generated:** $(date)
**Application:** Daiyet App
**Framework:** Next.js 16.0.8
**Database:** Supabase
