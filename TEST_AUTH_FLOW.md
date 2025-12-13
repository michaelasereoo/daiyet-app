# Testing Authentication Flow

## ✅ Current Status

Based on debug endpoint output:
- ✅ Session is active
- ✅ User authenticated: `michaelasereoo@gmail.com`
- ✅ Cookies are set correctly
- ✅ Environment variables configured

## Next Steps: Test Full OAuth Flow

### 1. Test OAuth Initiation

Open browser console and navigate to `/login` or `/signup`, then:

```javascript
// Check if OAuth button works
// Click "Continue with Google"
// Watch for redirect to Google
```

**Expected:**
- Redirects to `accounts.google.com`
- Shows Google consent screen
- After consent, redirects back to `/auth/callback?code=xxx`

### 2. Test Callback Handler

After OAuth completes, check server logs for:

```
AuthCallbackExchangingCode
AuthCallbackUserAuthenticated
AuthCallbackSuccess
```

**Check redirect:**
- Should redirect to `/user-dashboard` (for USER role)
- Should redirect to `/dashboard` (for DIETITIAN role)
- Should redirect to `/admin` (for ADMIN role)

### 3. Test User Role in Database

Check what role your user has:

```sql
-- In Supabase SQL Editor
SELECT id, email, role, account_status 
FROM users 
WHERE email = 'michaelasereoo@gmail.com';
```

**Expected roles:**
- `USER` → redirects to `/user-dashboard`
- `DIETITIAN` → redirects to `/dashboard`
- `ADMIN` → redirects to `/admin`

### 4. Test Protected Routes

Try accessing:
- `/user-dashboard` - Should work if role is USER
- `/dashboard` - Should work if role is DIETITIAN
- `/admin` - Should work if role is ADMIN

**If redirected to login:**
- Check middleware logs
- Verify user role in database
- Check account_status is "ACTIVE"

## Common Issues

### Issue: "Redirects to login after OAuth"

**Check:**
1. User exists in database: `SELECT * FROM users WHERE id = 'b900e502-71a6-45da-bde6-7b596cc14d88'`
2. User has a role set: `SELECT role FROM users WHERE id = 'b900e502-71a6-45da-bde6-7b596cc14d88'`
3. Account status is ACTIVE: `SELECT account_status FROM users WHERE id = 'b900e502-71a6-45da-bde6-7b596cc14d88'`

**Fix:**
```sql
-- If user doesn't exist, create it
INSERT INTO users (id, email, role, account_status)
VALUES ('b900e502-71a6-45da-bde6-7b596cc14d88', 'michaelasereoo@gmail.com', 'USER', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET role = 'USER', account_status = 'ACTIVE';

-- If user exists but no role
UPDATE users 
SET role = 'USER', account_status = 'ACTIVE'
WHERE id = 'b900e502-71a6-45da-bde6-7b596cc14d88';
```

### Issue: "Infinite redirect loop"

**Check:**
1. Middleware is not blocking the redirect path
2. `determineUserRedirect` returns a valid path
3. Account status is not causing redirects

**Debug:**
```bash
# Check server logs for redirect patterns
# Look for: AuthCallbackSuccess with redirectTo value
```

### Issue: "OAuth button doesn't work"

**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. Supabase dashboard → Authentication → Providers → Google (enabled?)

**Fix:**
- Verify Google OAuth is enabled in Supabase
- Check redirect URLs match exactly
- Clear browser cache and cookies

## Quick Test Commands

```bash
# 1. Test debug endpoint
curl http://localhost:3000/api/debug/auth

# 2. Test if user exists (via API if you have one)
# Or use Supabase SQL Editor

# 3. Check server logs
# Look for AuthCallback* messages
```

## What to Report

If you're experiencing issues, please provide:

1. **What happens when you click "Continue with Google"?**
   - Does it redirect to Google?
   - Does it show an error?
   - Does it do nothing?

2. **After OAuth completes, where do you end up?**
   - Correct dashboard?
   - Login page?
   - Error page?
   - Infinite loop?

3. **Server logs:**
   - Any `AuthCallback*` messages?
   - Any errors?

4. **Database check:**
   - Does user exist in `users` table?
   - What is their `role`?
   - What is their `account_status`?

---

**Your current session looks good!** The authentication is working. If you're having issues, they're likely with:
- Redirect logic (where you go after auth)
- Role assignment (what role you have)
- Route protection (middleware blocking access)

Let me know what specific issue you're seeing!

