# Fix User Record Issue - michaelasereoo@gmail.com

## Problem
User signed up as dietitian but getting "no user record found" error.

## Root Cause
This happens when:
1. User signs in with Google OAuth (creates auth user)
2. Enrollment process doesn't complete or fails
3. Database user record is never created or gets deleted
4. Auth user exists but database user doesn't

## Solution

### Option 1: Check User Status (Recommended First Step)

Use the debug endpoint to check the user's current status:

```bash
# If you're logged in as the user
curl http://localhost:3000/api/debug/user

# Or use the fix-user endpoint
curl -X POST http://localhost:3000/api/fix-user \
  -H "Content-Type: application/json" \
  -d '{"action": "check", "email": "michaelasereoo@gmail.com"}'
```

### Option 2: Create Missing User Record

If the user exists in auth but not in database:

```bash
curl -X POST http://localhost:3000/api/fix-user \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "email": "michaelasereoo@gmail.com"}'
```

This will create a basic user record with role "USER".

### Option 3: Update Role to DIETITIAN

If the user record exists but role is wrong:

```bash
curl -X POST http://localhost:3000/api/fix-user \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-role",
    "email": "michaelasereoo@gmail.com",
    "role": "DIETITIAN"
  }'
```

### Option 4: Complete Enrollment Again

The user can:
1. Go to `/dietitian-enrollment`
2. Sign in with Google (if not already signed in)
3. Complete the enrollment form
4. Submit the form

The enrollment API will:
- Update existing user record if it exists
- Create new record if it doesn't exist
- Set role to "DIETITIAN"

## Manual Database Fix (If API doesn't work)

If you have access to Supabase SQL Editor:

```sql
-- Check if user exists
SELECT * FROM auth.users WHERE email = 'michaelasereoo@gmail.com';

-- Check database user
SELECT * FROM users WHERE email = 'michaelasereoo@gmail.com';

-- If auth user exists but database user doesn't:
-- Get the auth user ID first, then:
INSERT INTO users (
  id,
  email,
  name,
  role,
  account_status,
  email_verified,
  created_at,
  updated_at
) VALUES (
  'AUTH_USER_ID_HERE',  -- Replace with actual auth user ID
  'michaelasereoo@gmail.com',
  'Michael Asereoo',  -- Or get from auth.users.user_metadata
  'DIETITIAN',
  'ACTIVE',
  true,
  NOW(),
  NOW()
);
```

## Prevention

To prevent this in the future:
1. Ensure enrollment form completes successfully
2. Check enrollment API response for errors
3. Verify user record is created after enrollment
4. Add better error handling in enrollment flow

## Testing

After fixing, test by:
1. Signing in at `/dietitian-login`
2. Should redirect to `/dashboard` if role is DIETITIAN
3. Check `/api/debug/user` to verify role
