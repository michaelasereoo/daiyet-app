# Authentication Quick Reference Guide

## 🔑 Common Patterns & Snippets

### 1. Check Authentication in Server Component

```typescript
import { createServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const supabase = await createServerComponentClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }
  
  // Use session.user.id, session.user.email, etc.
  return <div>Protected content</div>;
}
```

### 2. Check Role in Server Component

```typescript
import { createAdminClientServer } from '@/lib/supabase/server';
import { normalizeRole } from '@/lib/utils/auth-utils';

export default async function AdminPage() {
  const supabase = await createServerComponentClient();
  const supabaseAdmin = createAdminClientServer();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/auth/signin');
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();
  
  const role = normalizeRole(user?.role);
  
  if (role !== 'ADMIN') {
    redirect('/user-dashboard');
  }
  
  return <div>Admin content</div>;
}
```

### 3. Check Authentication in Client Component

```typescript
'use client';

import { createComponentClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProtectedClientComponent() {
  const supabase = createComponentClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      
      setUser(session.user);
      setLoading(false);
    }
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/auth/signin');
        } else if (event === 'SIGNED_IN') {
          setUser(session.user);
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (!user) return null;
  
  return <div>Protected content</div>;
}
```

### 4. Protected API Route

```typescript
import { createRouteHandlerClientFromRequest, createAdminClientServer } from '@/lib/supabase/server';
import { getCookieHeader } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Get session
  const cookieHeader = getCookieHeader(request);
  const supabase = createRouteHandlerClientFromRequest(cookieHeader);
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Check role if needed
  const supabaseAdmin = createAdminClientServer();
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('role, account_status')
    .eq('id', session.user.id)
    .single();
  
  if (user?.account_status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'Account not active' },
      { status: 403 }
    );
  }
  
  // Your API logic here
  return NextResponse.json({ success: true });
}
```

### 5. Check Permission (Future RBAC)

```typescript
import { checkPermission } from '@/lib/rbac/check-permission';

export async function POST(request: NextRequest) {
  // ... get session and user ...
  
  const hasPermission = await checkPermission(
    session.user.id,
    'event:create'
  );
  
  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }
  
  // Continue with operation
}
```

### 6. Sign Out

```typescript
'use client';

import { createComponentClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const supabase = createComponentClient();
  const router = useRouter();
  
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/signin');
    router.refresh();
  }
  
  return <button onClick={handleSignOut}>Sign Out</button>;
}
```

### 7. Get Current User Helper

```typescript
// lib/auth/get-current-user.ts

import { createServerComponentClient } from '@/lib/supabase/server';
import { createAdminClientServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { AppUser } from '@/lib/auth/types';

export async function getCurrentUser(): Promise<AppUser> {
  const supabase = await createServerComponentClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect('/auth/signin');
  }
  
  const supabaseAdmin = createAdminClientServer();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (error || !user) {
    redirect('/auth/signin');
  }
  
  return user as AppUser;
}

// Usage:
export default async function ProfilePage() {
  const user = await getCurrentUser();
  return <div>Welcome, {user.name}</div>;
}
```

### 8. Require Role Helper

```typescript
// lib/auth/require-role.ts

import { getCurrentUser } from './get-current-user';
import { UserRole } from '@/lib/auth/types';
import { redirect } from 'next/navigation';
import { normalizeRole } from '@/lib/utils/auth-utils';

export async function requireRole(...roles: UserRole[]): Promise<AppUser> {
  const user = await getCurrentUser();
  const userRole = normalizeRole(user.role);
  
  if (!roles.includes(userRole)) {
    redirect('/user-dashboard'); // Redirect to default dashboard
  }
  
  return user;
}

// Usage:
export default async function AdminPage() {
  const user = await requireRole('ADMIN');
  return <div>Admin dashboard</div>;
}

export default async function DietitianPage() {
  const user = await requireRole('DIETITIAN', 'ADMIN');
  return <div>Dietitian dashboard</div>;
}
```

### 9. Sign In with Google

```typescript
'use client';

import { createComponentClient } from '@/lib/supabase/client';
import { authConfig } from '@/lib/auth/config';

export function GoogleSignInButton() {
  const supabase = createComponentClient();
  
  async function handleSignIn() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: authConfig.providers.google.additionalParams.access_type,
          prompt: authConfig.providers.google.additionalParams.prompt,
          include_granted_scopes: authConfig.providers.google.additionalParams.include_granted_scopes,
        },
        scopes: authConfig.providers.google.scopes.join(' '),
      },
    });
    
    if (error) {
      console.error('Sign in error:', error);
    }
  }
  
  return <button onClick={handleSignIn}>Continue with Google</button>;
}
```

### 10. Check Account Status

```typescript
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { getAccountStatusRedirect } from '@/lib/utils/auth-utils';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const user = await getCurrentUser();
  
  // Check account status
  const statusRedirect = getAccountStatusRedirect(user.account_status);
  
  if (statusRedirect) {
    redirect(statusRedirect);
  }
  
  return <div>Page content</div>;
}
```

---

## 🔍 Common Debugging Queries

### Check User Session

```typescript
const supabase = createComponentClient();
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('User:', session?.user);
```

### Check User Role

```sql
SELECT id, email, role, account_status, email_verified, last_sign_in_at
FROM users
WHERE id = 'USER_ID_HERE';
```

### Check Recent Sign-Ins

```sql
SELECT *
FROM auth_audit_log
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC
LIMIT 10;
```

### Check Access Logs

```sql
SELECT *
FROM access_logs
WHERE user_id = 'USER_ID_HERE'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🚨 Common Issues & Solutions

### Issue: "Session not found" in middleware

**Solution:**
- Check that cookies are being sent correctly
- Verify Supabase URL and keys are correct
- Check browser console for cookie-related errors

### Issue: "User role is null"

**Solution:**
- Ensure user exists in `users` table
- Check that RLS policies allow reading user data
- Use admin client for role checks: `createAdminClientServer()`

### Issue: "Redirect loop"

**Solution:**
- Check middleware matcher config
- Verify public routes are correctly defined
- Ensure redirect paths don't require auth themselves

### Issue: "OAuth callback fails"

**Solution:**
- Verify redirect URL matches Google OAuth console settings
- Check state parameter encoding/decoding
- Verify Supabase callback URL is configured

---

## 📋 Migration Checklist

When updating auth system:

- [ ] Test sign-in flow
- [ ] Test sign-out flow
- [ ] Test role-based redirects
- [ ] Test account status checks
- [ ] Test middleware on protected routes
- [ ] Test public routes are accessible
- [ ] Verify RLS policies still work
- [ ] Check audit logs are being written
- [ ] Test rate limiting
- [ ] Verify error pages render correctly
- [ ] Test on multiple devices/browsers
- [ ] Check session persistence
- [ ] Verify security headers

---

## 🔗 Key Files Reference

- **Auth Config**: `lib/auth/config.ts`
- **Auth Utils**: `lib/utils/auth-utils.ts`
- **Auth Types**: `lib/auth/types.ts` (new)
- **Middleware**: `middleware.ts`
- **Auth Callback**: `app/auth/callback/route.ts`
- **Supabase Client**: `lib/supabase/client.ts`
- **Supabase Server**: `lib/supabase/server.ts`
- **Auth Screen**: `components/auth/AuthScreen.tsx`
