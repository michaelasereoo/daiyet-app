# Supabase OAuth Redirect Fix

## Issue
After Google OAuth authentication, users are being redirected to `localhost` instead of the production URL `https://daiyet.store`.

## Root Cause
The issue can be caused by two things:
1. **Code-level**: Using `window.location.origin` instead of `NEXT_PUBLIC_SITE_URL` ✅ FIXED
2. **Supabase Dashboard Configuration**: Supabase has localhost configured as the redirect URL ❌ NEEDS MANUAL FIX

## Code Fixes Applied
✅ Updated `components/auth/AuthScreen.tsx` to use `NEXT_PUBLIC_SITE_URL`
✅ Updated `app/dietitian-enrollment/page.tsx` to use `NEXT_PUBLIC_SITE_URL`
✅ Updated `app/auth/callback/route.ts` to use `NEXT_PUBLIC_SITE_URL` for all redirects

## Required: Supabase Dashboard Configuration

You **MUST** update the Supabase dashboard configuration:

### Steps:
1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **Authentication** → **URL Configuration**
3. Check the following settings:

   **Site URL:**
   - Should be: `https://daiyet.store`
   - NOT: `http://localhost:3000`

   **Redirect URLs:**
   - Must include: `https://daiyet.store/auth/callback`
   - Can also include: `http://localhost:3000/auth/callback` (for development)
   - Remove any localhost-only configurations if you're only using production

4. **Save** the changes

### Example Configuration:
```
Site URL: https://daiyet.store

Redirect URLs:
- https://daiyet.store/auth/callback
- https://daiyet.store/**
- http://localhost:3000/auth/callback (optional, for local dev)
```

## Verification

After updating Supabase configuration:
1. Clear browser cache and cookies
2. Try Google OAuth login again
3. Check browser console for the redirect URL being used (should show `https://daiyet.store/auth/callback`)
4. Verify you're redirected to `https://daiyet.store` after authentication

## Environment Variable

Make sure `NEXT_PUBLIC_SITE_URL` is set in Netlify:
```bash
npx netlify env:list --context production
```

Should show:
```
NEXT_PUBLIC_SITE_URL | https://daiyet.store
```

If not set, add it:
```bash
npx netlify env:set NEXT_PUBLIC_SITE_URL "https://daiyet.store" --context production
```

## Additional Check: Google Cloud Console

Also verify in Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Check **Authorized redirect URIs**:
   - Should include: `https://daiyet.store/auth/callback`
   - Should include: `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
