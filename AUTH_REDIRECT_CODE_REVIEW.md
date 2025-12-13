# Complete Authentication & Redirect Flow - Dietitian Dashboard

## Overview
This document contains all relevant code for the authentication and redirect flow that routes dietitians to `/dashboard` after Google OAuth login.

---

## 🔄 Complete Flow Diagram

```
1. User visits /dietitian-login
   ↓
2. Clicks "Continue with Google"
   ↓
3. AuthScreen initiates OAuth with redirectTo: /auth/callback?redirect=/dashboard
   ↓
4. Google OAuth authentication
   ↓
5. Google redirects to /auth/callback?code=xxx&redirect=/dashboard
   ↓
6. Auth callback route:
   - Exchanges code for session
   - Fetches user role from database
   - Checks if role === "DIETITIAN"
   - Redirects to /dashboard ✅
   ↓
7. Middleware (safety net):
   - If user lands on /, checks role and redirects to /dashboard
   - Protects /dashboard routes
```

---

## 📁 File 1: Auth Callback Route
**Location:** `app/auth/callback/route.ts`

This is the **primary redirect handler** that processes OAuth callbacks and routes users based on their role.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedRedirect = requestUrl.searchParams.get("redirect");

  console.log("=== AUTH CALLBACK STARTED ===");
  console.log("Code present:", !!code);
  console.log("Requested redirect:", requestedRedirect);
  console.log("Full URL:", requestUrl.toString());
  console.log("All search params:", Object.fromEntries(requestUrl.searchParams.entries()));

  // Check for error parameter from OAuth
  const error = requestUrl.searchParams.get("error");
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, requestUrl.origin));
  }

  if (!code) {
    console.log("No code found in query params. This might be a hash-based redirect.");
    console.log("Note: Hash fragments (#access_token) are client-side only and not accessible server-side.");
    console.log("Redirecting to home - client-side should handle the hash fragment.");
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.redirect(new URL("/?error=config_error", requestUrl.origin));
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Exchanging code for session...");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.user) {
      console.error("Auth error:", error);
      return NextResponse.redirect(new URL("/?error=auth_failed", requestUrl.origin));
    }

    console.log("User authenticated:", data.user.id);
    console.log("User email:", data.user.email);

    // Get Google profile picture from metadata
    const googleImage = 
      data.user.user_metadata?.avatar_url ||
      data.user.user_metadata?.picture ||
      data.user.user_metadata?.image ||
      null;

    // Validate supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error("supabaseAdmin is not configured - missing SUPABASE_SERVICE_ROLE_KEY");
      // Fallback: try to get user with regular client (might fail due to RLS)
      console.log("Attempting to use regular client as fallback...");
    }

    // Get user role from database - try multiple times to ensure we get the role
    let finalUser = null;
    let userError = null;
    
    // First attempt to get user
    const { data: user, error: initialUserError } = await supabaseAdmin
      .from("users")
      .select("role, image")
      .eq("id", data.user.id)
      .single();

    if (user && user.role) {
      finalUser = user;
    } else if (initialUserError && initialUserError.code === "PGRST116") {
      // User doesn't exist (PGRST116 is the "not found" error code)
      // Create them with Google profile picture as USER
      const { error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || null,
          image: googleImage,
          role: "USER",
        });

      if (createError) {
        console.error("Error creating user:", createError);
        userError = createError;
      } else {
        // Re-fetch the newly created user
        const { data: newUser } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();
        if (newUser) finalUser = newUser;
      }
    } else {
      userError = initialUserError;
      // If there was an error but user might exist, try fetching again
      const { data: retryUser, error: retryError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();
      
      if (retryUser && retryUser.role) {
        finalUser = retryUser;
      } else {
        userError = retryError || userError;
      }
    }

    // Update user image if needed (for regular users only)
    if (finalUser && finalUser.role === "USER" && googleImage && !finalUser.image) {
      await supabaseAdmin
        .from("users")
        .update({ image: googleImage })
        .eq("id", data.user.id);
    }

    // Always re-fetch user role with retry logic to ensure we have the latest (important after enrollment)
    let userToCheck = finalUser;
    let retries = 3;
    let latestError = null;

    while (retries > 0) {
      console.log(`Fetching user role (attempt ${4 - retries}/3)...`);
      const { data: latestUser, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (fetchError) {
        console.error("Error fetching user role:", fetchError);
        latestError = fetchError;
      } else if (latestUser?.role) {
        userToCheck = latestUser;
        console.log("Found user role:", latestUser.role);
        break;
      }

      retries--;
      if (retries > 0) {
        // Wait 500ms before retry (helps with timing issues after enrollment)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Determine redirect path based on role - ALWAYS prioritize role over requestedRedirect
    let redirectPath = "/user-dashboard"; // default for regular users

    if (userToCheck && userToCheck.role) {
      const role = String(userToCheck.role).toUpperCase().trim() as "USER" | "DIETITIAN" | "ADMIN";
      
      // DIETITIAN role ALWAYS goes to /dashboard (dietitian dashboard)
      if (role === "DIETITIAN") {
        redirectPath = "/dashboard";
        console.log("Auth callback: Redirecting DIETITIAN to /dashboard", { 
          userId: data.user.id, 
          email: data.user.email,
          role: userToCheck.role 
        });
      } else if (role === "ADMIN") {
        redirectPath = "/admin";
      } else {
        // USER role goes to /user-dashboard (regular user dashboard)
        redirectPath = "/user-dashboard";
        console.log("Auth callback: Redirecting USER to /user-dashboard", { 
          userId: data.user.id, 
          email: data.user.email,
          role: userToCheck.role 
        });
      }
    } else {
      // User doesn't exist in database yet or error fetching - check requestedRedirect
      console.log("Auth callback: User role not found", { 
        userId: data.user.id, 
        email: data.user.email,
        latestError,
        requestedRedirect 
      });
      if (requestedRedirect?.includes("dietitian") || requestedRedirect === "/dashboard") {
        redirectPath = "/dietitian-enrollment";
      } else if (requestedRedirect) {
        redirectPath = requestedRedirect;
      } else {
        redirectPath = "/";
      }
    }

    console.log("Auth callback: Final redirect", { redirectPath, requestedRedirect, userRole: userToCheck?.role });
    return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
  } catch (error: any) {
    console.error("Auth callback error:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.redirect(new URL(`/?error=auth_failed&details=${encodeURIComponent(error?.message || "Unknown error")}`, requestUrl.origin));
  }
}
```

**Key Points:**
- ✅ Exchanges OAuth code for session
- ✅ Fetches user role from database with retry logic (3 attempts, 500ms delay)
- ✅ **DIETITIAN role → `/dashboard`** (line 164-170)
- ✅ Role-based redirect takes priority over `requestedRedirect` parameter
- ✅ Comprehensive error handling and logging

---

## 📁 File 2: Dietitian Login Page
**Location:** `app/dietitian-login/page.tsx`

This page renders the login UI and passes the redirect path to AuthScreen.

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default function DietitianLoginPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // User is already logged in, check if they're a dietitian
        const { data: user } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (user?.role === "DIETITIAN") {
          // Already logged in as dietitian, redirect to dashboard
          router.push("/dashboard");
        }
      }
    };

    checkSession();
  }, [router]);

  return (
    <AuthScreen
      title="Dietitian login"
      subtitle="Sign in with Google to access your dietitian dashboard."
      redirectPath="/dashboard"  // ← This is passed to AuthScreen
    />
  );
}
```

**Key Points:**
- ✅ Checks if user is already logged in and redirects if dietitian
- ✅ Passes `redirectPath="/dashboard"` to AuthScreen component

---

## 📁 File 3: AuthScreen Component
**Location:** `components/auth/AuthScreen.tsx`

This component handles the Google OAuth initiation and constructs the redirect URL.

```typescript
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface AuthScreenProps {
  title: string;
  subtitle: string;
  redirectPath?: string;
}

export function AuthScreen({ title, subtitle, redirectPath = "/user-dashboard" }: AuthScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Explicitly set redirect with both 'redirect' and 'redirect_to' for compatibility
      const redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
      console.log("Initiating Google OAuth with redirect:", redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,  // ← This tells Supabase where to redirect after OAuth
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
      setIsLoading(false);
    }
  };

  // ... rest of UI component
}
```

**Key Points:**
- ✅ Constructs redirect URL: `/auth/callback?redirect=/dashboard`
- ✅ Initiates Google OAuth with `redirectTo` parameter
- ✅ For dietitian login, `redirectPath="/dashboard"` is passed in

---

## 📁 File 4: Middleware (Safety Net)
**Location:** `middleware.ts`

This acts as a **safety net** to catch any edge cases where users might land on the wrong page.

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Safety net: If authenticated dietitian lands on homepage, redirect to dashboard
  if (pathname === "/") {
    const cookieHeader = request.headers.get("cookie") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          const match = cookieHeader.match(new RegExp(`(^| )${name}=([^;]+)`));
          return match ? decodeURIComponent(match[2]) : null;
        },
        set() {},
        remove() {},
      },
    });

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseServiceKey) {
        const { createClient: createAdminClient } = await import("@supabase/supabase-js");
        const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .single();

        if (user?.role === "DIETITIAN") {
          console.log("Middleware: Redirecting dietitian from / to /dashboard");
          return NextResponse.redirect(new URL("/dashboard", request.url));  // ← Safety net redirect
        } else if (user?.role === "ADMIN") {
          return NextResponse.redirect(new URL("/admin", request.url));
        } else if (user?.role === "USER") {
          return NextResponse.redirect(new URL("/user-dashboard", request.url));
        }
      }
    }
  }

  // Protect dietitian dashboard routes
  if (pathname.startsWith("/dashboard")) {
    const cookieHeader = request.headers.get("cookie") || "";

    // Create Supabase client with cookie support
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          const match = cookieHeader.match(new RegExp(`(^| )${name}=([^;]+)`));
          return match ? decodeURIComponent(match[2]) : null;
        },
        set() {},
        remove() {},
      },
    });

    // Get user from session
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      // Not authenticated - redirect to login
      const loginUrl = new URL("/dietitian-login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Get user role from database
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseServiceKey) {
      const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: user } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", authUser.id)
        .single();

      // Check if user is a dietitian
      if (!user || user.role !== "DIETITIAN") {
        // Not a dietitian - redirect to appropriate page
        if (user?.role === "USER") {
          return NextResponse.redirect(new URL("/user-dashboard", request.url));
        } else if (user?.role === "ADMIN") {
          return NextResponse.redirect(new URL("/admin", request.url));
        } else {
          // No role or not enrolled - redirect to enrollment
          return NextResponse.redirect(new URL("/dietitian-enrollment", request.url));
        }
      }
    }
  }

  // ... admin routes protection ...

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};
```

**Key Points:**
- ✅ **Homepage safety net**: If dietitian lands on `/`, redirects to `/dashboard` (line 46-48)
- ✅ **Dashboard protection**: Only allows DIETITIAN role to access `/dashboard` routes
- ✅ Redirects non-dietitians to appropriate pages

---

## 📁 File 5: Enrollment API (Sets Role)
**Location:** `app/api/dietitians/enroll/route.ts` (excerpt)

This shows how the DIETITIAN role is set during enrollment.

```typescript
// ... enrollment validation code ...

// Update or create user record with DIETITIAN role
const userData: any = {
  name: fullName,
  email: email,
  role: "DIETITIAN",  // ← Role is set here during enrollment
  bio: bio,
};

if (imageUrl) {
  userData.image = imageUrl;
}

let user;
if (existingUser) {
  // Update existing user
  const { data: updatedUser, error: updateError } = await supabaseAdmin
    .from("users")
    .update(userData)  // ← Updates role to "DIETITIAN"
    .eq("id", authUser.id)
    .select()
    .single();
  // ...
} else {
  // Create new user
  const { data: newUser, error: createError } = await supabaseAdmin
    .from("users")
    .insert({
      id: authUser.id,
      ...userData,  // ← Creates user with role "DIETITIAN"
    })
    .select()
    .single();
  // ...
}
```

**Key Points:**
- ✅ Sets `role: "DIETITIAN"` in database during enrollment
- ✅ This role is what the auth callback checks to determine redirect

---

## 📁 File 6: Supabase Client Configuration
**Location:** `lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// For server-side operations, use service role key if available
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for admin operations)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase;
```

**Key Points:**
- ✅ `supabaseAdmin` uses service role key to bypass RLS
- ✅ Required for fetching user role in server-side routes

---

## 🔑 Critical Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # CRITICAL for role checks!
```

---

## 🎯 Redirect Logic Summary

### Primary Flow (Auth Callback):
1. User completes Google OAuth
2. Google redirects to `/auth/callback?code=xxx&redirect=/dashboard`
3. Auth callback:
   - Exchanges code for session
   - Fetches user role from database (with retry)
   - **If role === "DIETITIAN" → redirect to `/dashboard`** ✅
   - If role === "USER" → redirect to `/user-dashboard`
   - If role === "ADMIN" → redirect to `/admin`

### Safety Net (Middleware):
- If dietitian lands on `/` → redirect to `/dashboard`
- Protects `/dashboard` routes (only DIETITIAN can access)

### Role Setting:
- During enrollment, API sets `role: "DIETITIAN"` in database
- This role is checked during auth callback to determine redirect

---

## 🐛 Debugging

### Check User Role:
```sql
-- In Supabase SQL Editor
SELECT id, email, role, created_at 
FROM users 
WHERE email = 'dietitian@example.com';
```

### Check Auth State:
```bash
# Visit in browser
GET /api/debug/user
```

### Check Server Logs:
Look for these log messages:
- `"Auth callback: Redirecting DIETITIAN to /dashboard"`
- `"Found user role: DIETITIAN"`
- `"Middleware: Redirecting dietitian from / to /dashboard"`

---

## ✅ Expected Behavior

1. **Dietitian visits `/dietitian-login`**
2. **Clicks "Continue with Google"**
3. **Completes Google authentication**
4. **Gets redirected to `/dashboard`** ✅ (not homepage, not user-dashboard)
5. **If somehow lands on homepage, middleware redirects to `/dashboard`**

---

## 📝 Notes for Senior Dev

- **Role-based redirect takes priority** over `requestedRedirect` parameter
- **Retry logic** (3 attempts, 500ms delay) handles timing issues after enrollment
- **Multiple layers of protection**: Auth callback + Middleware
- **Case-insensitive role check** (`toUpperCase().trim()`)
- **Comprehensive logging** for debugging
