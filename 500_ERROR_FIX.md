# 500 Error Fix - Auth Callback

## Issue
Getting `500 (Internal Server Error)` when accessing `/auth/callback?redirect=%2Fdashboard#access_token=...`

## Root Causes

1. **Hash Fragment Issue**: The URL shows `#access_token=...` which means Supabase is redirecting with token in hash fragment. Hash fragments are **client-side only** and not accessible to server-side routes.

2. **Missing Code Parameter**: The server route expects a `code` parameter to exchange for a session, but if Supabase is using implicit flow or misconfigured, there won't be a code.

3. **Possible Missing Environment Variables**: `SUPABASE_SERVICE_ROLE_KEY` might not be set, causing `supabaseAdmin` to be undefined.

## Fixes Applied

### 1. Enhanced Error Handling
- Added validation for environment variables
- Added check for `supabaseAdmin` availability
- Better error logging with details

### 2. Client-Side Handler Created
- Created `/app/auth/callback-handler/page.tsx` to handle hash-based redirects
- This handles cases where Supabase redirects with token in hash fragment

### 3. Better Error Messages
- More descriptive error logging
- Error details passed in redirect URL for debugging

## Immediate Actions

### Check Environment Variables
```bash
# Make sure these are set in .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # CRITICAL!
```

### Check Supabase Dashboard
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Ensure **Redirect URLs** includes: `http://localhost:3000/auth/callback`
3. Ensure **Site URL** is set to: `http://localhost:3000`

### Check OAuth Flow Type
- Supabase should use **Authorization Code Flow** (not Implicit Flow)
- This provides a `code` parameter, not tokens in hash

## Testing

1. **Check Server Logs**: Look for error messages starting with "Auth callback error:"
2. **Check Environment**: Verify all Supabase env vars are set
3. **Try Again**: Clear browser cache and try login again
4. **Check Network Tab**: See what the actual response is from `/auth/callback`

## Alternative Solution

If the issue persists, you can use the client-side handler:

1. Update `components/auth/AuthScreen.tsx` to redirect to `/auth/callback-handler` instead of `/auth/callback`
2. The client-side handler will process both code-based and hash-based redirects

## Debug Steps

1. Check terminal/console for error logs
2. Visit `/api/debug/user` to check current auth state
3. Check browser console for client-side errors
4. Verify Supabase redirect URL configuration
