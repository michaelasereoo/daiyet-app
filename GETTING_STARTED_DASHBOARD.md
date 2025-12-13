# Getting Started - Access Dietitian Dashboard

## Quick Steps to Access Your Dashboard

### Option 1: Use Quick Fix Utility (Easiest - 30 seconds)

1. **Sign in with Google** (if not already signed in)
   - Go to: `/dietitian-login` or `/auth/signin`
   - Click "Continue with Google"

2. **Use the Quick Fix Tool**
   - Navigate to: `/admin/quick-fix`
   - Click "1. Check Current User Status"
   - If user record doesn't exist: Click "2. Create User Record"
   - Click "3. Update Role to DIETITIAN"
   - You'll be automatically redirected to `/dashboard` after 3 seconds

### Option 2: Complete Full Enrollment

1. **Sign in with Google**
   - Go to: `/dietitian-login`

2. **Complete Enrollment Form**
   - Go to: `/dietitian-enrollment`
   - Fill out the form with your dietitian information
   - Submit the form
   - You'll be redirected to `/dashboard`

### Option 3: Manual Database Update (If you have Supabase access)

1. Sign in with Google to get your user ID
2. Open Supabase SQL Editor
3. Run this SQL (replace `YOUR_USER_ID` with your actual user ID):

```sql
-- Check your user
SELECT id, email, role, account_status FROM users WHERE email = 'your-email@gmail.com';

-- Update role to DIETITIAN
UPDATE users 
SET role = 'DIETITIAN', 
    account_status = 'ACTIVE',
    updated_at = NOW()
WHERE email = 'your-email@gmail.com';
```

---

## After Setting Role to DIETITIAN

Once your role is set to `DIETITIAN`, you can access:

- ✅ **`/dashboard`** - Main dashboard with stats and upcoming bookings
- ✅ **`/dashboard/event-types`** - Create and manage consultation types
- ✅ **`/dashboard/bookings`** - View and manage bookings
- ✅ **`/dashboard/settings`** - Profile and account settings

---

## Troubleshooting

### "User not found in database"

**Solution**: Use the Quick Fix tool (`/admin/quick-fix`) to create your user record.

### "Role mismatch" or "Access denied"

**Solution**: 
1. Check your role: Go to `/admin/quick-fix` and click "Check Current User Status"
2. If role is not DIETITIAN, click "Update Role to DIETITIAN"

### "Redirected to wrong page"

**Solution**: 
- If you're a DIETITIAN but getting redirected to `/user-dashboard`, your role might not be set correctly
- Use Quick Fix tool to verify and update role

### Still having issues?

1. Check browser console for errors
2. Check server logs for detailed error messages
3. Verify you're signed in: The Quick Fix tool will tell you if you're authenticated

---

## Quick Links

- **Quick Fix Tool**: `/admin/quick-fix`
- **Dietitian Login**: `/dietitian-login`
- **Enrollment**: `/dietitian-enrollment`
- **Dashboard**: `/dashboard` (requires DIETITIAN role)

---

## What the System Checks

When you try to access `/dashboard`, the system checks:

1. ✅ **Authentication**: Are you signed in? (Supabase session)
2. ✅ **User Record**: Does your user exist in the database?
3. ✅ **Role**: Is your role set to `DIETITIAN`?
4. ✅ **Account Status**: Is your account `ACTIVE`?

All of these must pass for you to access the dashboard.

---

**Need help?** Use the Quick Fix tool at `/admin/quick-fix` - it will diagnose and fix most common issues automatically!
