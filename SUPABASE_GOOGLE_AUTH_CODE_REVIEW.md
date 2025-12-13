# Supabase Google Authentication - Complete Code Review

This document contains all relevant code for troubleshooting the Supabase Google OAuth authentication flow.

## Table of Contents
1. [Authentication Flow Overview](#authentication-flow-overview)
2. [Client-Side Auth Initiation](#client-side-auth-initiation)
3. [Server-Side Callback Handler](#server-side-callback-handler)
4. [Supabase Client Configuration](#supabase-client-configuration)
5. [Middleware Protection](#middleware-protection)
6. [Auth Configuration](#auth-configuration)
7. [Google Calendar Integration](#google-calendar-integration)
8. [Environment Variables Required](#environment-variables-required)

---

## Authentication Flow Overview

```
1. User clicks "Continue with Google" → AuthScreen.tsx
2. Client calls supabase.auth.signInWithOAuth() → Redirects to Google
3. Google redirects to Supabase → https://{project}.supabase.co/auth/v1/callback
4. Supabase redirects to app → /auth/callback?code=xxx&state=xxx
5. Server exchanges code for session → exchangeCodeForSession()
6. User created/fetched from database
7. Redirect based on role
```

---

## Client-Side Auth Initiation

### File: `components/auth/AuthScreen.tsx`

```tsx
"use client";

import { useState } from "react";
import { createComponentClient } from "@/lib/supabase/client";
import { authConfig } from "@/lib/auth/config";

export function AuthScreen({ title, subtitle, redirectPath = "/user-dashboard" }: AuthScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createComponentClient();

      // Encode state for security (CSRF protection)
      const state = btoa(
        JSON.stringify({
          redirectTo: redirectPath,
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(2),
        })
      );

      // Construct redirect URL with redirect path as query parameter
      const redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;
      console.log("Initiating Google OAuth with redirect:", redirectUrl, "redirectPath:", redirectPath);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: authConfig.providers.google.additionalParams.access_type,
            prompt: authConfig.providers.google.additionalParams.prompt,
            include_granted_scopes: authConfig.providers.google.additionalParams.include_granted_scopes,
          },
          scopes: authConfig.providers.google.scopes.join(" "),
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

  // ... rest of component
}
```

**Key Points:**
- Uses `createComponentClient()` from `lib/supabase/client.ts`
- Redirects to `/auth/callback?redirect={path}`
- Passes OAuth scopes and parameters from config

---

## Server-Side Callback Handler

### File: `app/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { authRateLimit } from "@/lib/rate-limit";
import { authConfig, getAuthConfig } from "@/lib/auth/config";
import { normalizeRole, getRedirectPathForRole, getAccountStatusRedirect, getUserRoleWithRetry } from "@/lib/utils/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

  try {
    // Rate limiting
    await authRateLimit.check(request, 10, "AUTH_CALLBACK");

    const { code, error, error_description, state } = searchParams;

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/auth/error?code=${error}&desc=${encodeURIComponent(error_description || "")}`,
          requestUrl.origin
        )
      );
    }

    // Parse state parameter (for CSRF protection and redirect)
    let redirectTo = "/";
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        redirectTo = stateData.redirectTo || redirectTo;
      } catch {
        const requestedRedirect = requestUrl.searchParams.get("redirect");
        redirectTo = requestedRedirect || redirectTo;
      }
    } else {
      const requestedRedirect = requestUrl.searchParams.get("redirect");
      redirectTo = requestedRedirect || redirectTo;
    }

    if (!code) {
      return NextResponse.redirect(new URL("/auth/signin", requestUrl.origin));
    }

    // Create Supabase client using @supabase/ssr (handles cookies automatically)
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Exchange code for session
    const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);

    if (authError || !authData.user || !authData.session) {
      throw authError || new Error("No user data or session returned");
    }

    const user = authData.user;
    const session = authData.session;
    const userMetadata = user.user_metadata;

    // Get or create user in database
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("id, role, email, name, image, account_status, email_verified")
      .eq("id", user.id)
      .single();

    let finalRole = "USER" as const;
    let finalUser = dbUser;
    const googleImage = userMetadata?.avatar_url || userMetadata?.picture || userMetadata?.image || null;

    if (dbError?.code === "PGRST116") {
      // User doesn't exist - create new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: user.id,
          email: user.email!,
          name: userMetadata?.name || userMetadata?.full_name || user.email!.split("@")[0],
          image: googleImage,
          role: "USER",
          account_status: "ACTIVE",
          email_verified: user.email_confirmed_at || null,
          last_sign_in_at: new Date().toISOString(),
          metadata: {
            provider: userMetadata?.provider || "google",
            provider_id: userMetadata?.provider_id,
          },
        })
        .select()
        .single();

      if (createError) {
        console.error("AuthCallbackCreateUserError", createError);
      } else {
        finalUser = newUser;
        finalRole = normalizeRole(newUser.role) as "USER";
      }
    } else if (dbUser) {
      // Update last sign-in for existing user
      await supabaseAdmin
        .from("users")
        .update({
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(googleImage && !dbUser.image ? { image: googleImage } : {}),
        })
        .eq("id", user.id);

      finalRole = normalizeRole(dbUser.role) as "USER";
    }

    // Get user role with retry logic
    const { role: userRole, error: roleError } = await getUserRoleWithRetry(
      supabaseAdmin,
      user.id,
      3,
      500
    );

    const finalRoleToUse = userRole || finalRole;

    // Check account status
    const accountStatus = finalUser?.account_status || "ACTIVE";
    const statusRedirect = getAccountStatusRedirect(accountStatus);

    if (statusRedirect) {
      return NextResponse.redirect(new URL(statusRedirect, requestUrl.origin));
    }

    // Determine redirect path based on role
    const redirectPath = getRedirectPathForRole(finalRoleToUse);

    // Create response with security headers
    const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
    
    // Security headers
    response.headers.set("X-Auth-Status", "success");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    return response;
  } catch (error: any) {
    console.error("AuthCallbackFatalError", error);
    
    const errorUrl = new URL("/auth/error", request.url);
    errorUrl.searchParams.set("type", "callback_error");

    const response = NextResponse.redirect(errorUrl);
    response.cookies.set({
      name: "auth_error",
      value: JSON.stringify({
        message: "Authentication failed",
        timestamp: new Date().toISOString(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60,
    });

    return response;
  }
}
```

**Key Points:**
- Uses `createClient()` from `@supabase/ssr` for server components
- Exchanges authorization code for session using `exchangeCodeForSession()`
- Creates user in database if doesn't exist
- Handles role-based redirects

---

## Supabase Client Configuration

### File: `lib/supabase/client.ts` (Browser Client)

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Component client (with cookies support)
export function createComponentClient() {
  // In browser context, reuse the browser client instance
  if (typeof window !== 'undefined') {
    if (browserClientInstance) {
      return browserClientInstance;
    }
    return createBrowserClient();
  }

  // In server context, create new instance
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// Browser client (for client components with localStorage)
export function createBrowserClient() {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserClient can only be used in browser context');
  }

  browserClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (url, options = {}) => {
        return fetch(url, {
          ...options,
          credentials: 'include', // Always include cookies
        });
      },
    },
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // IMPORTANT: Set to false for cookie-based auth
      storage: {
        getItem: (key: string) => {
          // Custom storage implementation that checks cookies and localStorage
          // ... (see full file for implementation)
        },
        setItem: (key: string, value: string) => {
          // Custom storage implementation
          // ... (see full file for implementation)
        },
        removeItem: (key: string) => {
          // Custom storage implementation
          // ... (see full file for implementation)
        },
      },
    },
  });

  return browserClientInstance;
}
```

**Key Points:**
- Uses PKCE flow (`flowType: 'pkce'`)
- Custom storage that checks both cookies and localStorage
- `detectSessionInUrl: false` to prevent URL-based session detection
- `credentials: 'include'` to send cookies with requests

### File: `lib/supabase/server/client.ts` (Server Client)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch (error) {
          console.error('Error setting cookies:', error)
        }
      },
    },
  })
}
```

**Key Points:**
- Uses `@supabase/ssr` package for server-side cookie handling
- Automatically reads/writes cookies from Next.js cookie store

### File: `lib/supabase/middleware/client.ts` (Middleware Client)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  return { supabase, response }
}
```

**Key Points:**
- Handles cookies in middleware context
- Returns both supabase client and response object

---

## Middleware Protection

### File: `middleware.ts`

```typescript
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/middleware/client";
import { createAdminClient } from "@/lib/supabase/server/admin";
import { authConfig } from "@/lib/auth/config";
import { normalizeRole, canAccessRoute, getAccountStatusRedirect } from "@/lib/utils/auth-utils";

const PUBLIC_ROUTES = [
  "/",
  "/auth/signin",
  "/auth/callback",
  "/auth/error",
  "/dietitian-login",
  "/dietitian-enrollment",
  "/login",
  "/signup",
  "/admin-login",
  // ... more public routes
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Create Supabase client using @supabase/ssr
  const { supabase, response } = createClient(request);

  try {
    // Get user (more reliable than getSession in middleware)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    // If no user, redirect to signin
    if (error || !user) {
      let signinPath = "/auth/signin";
      if (pathname.startsWith("/dashboard")) {
        signinPath = "/dietitian-login";
      } else if (pathname.startsWith("/admin")) {
        signinPath = "/admin-login";
      }

      const signinUrl = new URL(signinPath, request.url);
      signinUrl.searchParams.set("callbackUrl", encodeURIComponent(request.url));

      return NextResponse.redirect(signinUrl);
    }
    
    // Get user from database (using admin client for reliability)
    const supabaseAdmin = createAdminClient();

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role, email_verified, account_status")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      // User doesn't exist in database - redirect to complete profile
      return NextResponse.redirect(new URL("/dietitian-enrollment", request.url));
    }

    // Check account status
    const accountStatus = dbUser.account_status || "ACTIVE";
    const statusRedirect = getAccountStatusRedirect(accountStatus);

    if (statusRedirect) {
      return NextResponse.redirect(new URL(statusRedirect, request.url));
    }

    // Role-based access control
    const userRole = normalizeRole(dbUser.role);
    const allowedRoutes = ROLE_ROUTES[userRole] || ROLE_ROUTES.USER;

    // Check if user has access to this route
    const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route));

    if (!hasAccess) {
      // Redirect to appropriate dashboard based on role
      const redirectPath = authConfig.redirects[userRole] || "/";
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Add security headers
    response.headers.set("X-User-ID", user.id);
    response.headers.set("X-User-Role", userRole);

    return response;
  } catch (error) {
    console.error("MiddlewareError", error);
    
    const errorUrl = new URL("/auth/error", request.url);
    errorUrl.searchParams.set("type", "middleware_error");

    return NextResponse.redirect(errorUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
```

**Key Points:**
- Uses `getUser()` instead of `getSession()` (more reliable in middleware)
- Validates user exists in database
- Enforces role-based access control
- Checks account status

---

## Auth Configuration

### File: `lib/auth/config.ts`

```typescript
export const authConfig = {
  // Environment-specific settings
  development: {
    cookieOptions: {
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
    },
    sessionRefreshInterval: 60 * 1000, // 1 minute
  },
  production: {
    cookieOptions: {
      secure: true,
      sameSite: 'strict' as const,
      path: '/',
      domain: process.env.COOKIE_DOMAIN,
      httpOnly: true,
    },
    sessionRefreshInterval: 5 * 60 * 1000, // 5 minutes
  },

  // OAuth providers configuration
  providers: {
    google: {
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'openid',
      ],
      additionalParams: {
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
      },
    },
  },

  // Role-based redirects
  redirects: {
    DIETITIAN: '/dashboard',
    USER: '/user-dashboard',
    ADMIN: '/admin',
    default: '/',
  },

  // Session management
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
} as const;
```

**Key Points:**
- Google OAuth scopes: email, profile, openid
- `access_type: 'offline'` to get refresh tokens
- `prompt: 'consent'` to force consent screen

---

## Google Calendar Integration

### File: `lib/google-calendar.ts`

```typescript
import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/google/callback`
  );
}
```

**Note:** This is separate from Supabase auth - it's for Google Calendar API access.

### File: `app/api/auth/google/authorize/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  try {
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: request.nextUrl.searchParams.get("redirect") || "/dashboard",
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate authorization URL" },
      { status: 500 }
    );
  }
}
```

---

## Environment Variables Required

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth (for Calendar API - separate from Supabase auth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # or https://daiyet.store in production
```

---

## Common Issues to Check

1. **Redirect URL Mismatch**
   - Supabase dashboard → Authentication → URL Configuration
   - Must include: `http://localhost:3000/auth/callback` (dev) and `https://daiyet.store/auth/callback` (prod)

2. **Google OAuth Credentials**
   - Supabase dashboard → Authentication → Providers → Google
   - Must have Client ID and Client Secret configured
   - Google Cloud Console → Credentials → OAuth 2.0 Client
   - Must have redirect URI: `https://{project}.supabase.co/auth/v1/callback`

3. **Cookie Issues**
   - Check browser DevTools → Application → Cookies
   - Look for cookies starting with `sb-{project}-auth-token`
   - Ensure cookies are being set (check `Set-Cookie` headers in Network tab)

4. **PKCE Flow**
   - Code verifier should be stored in cookies (not HttpOnly)
   - Code verifier is used server-side to exchange code for session

5. **Session Exchange**
   - `exchangeCodeForSession()` must be called with the authorization code
   - Code is single-use and expires quickly

6. **Database User Creation**
   - Check if user exists in `users` table after auth
   - Check for errors in callback route logs

---

## Debugging Steps

1. **Check Browser Console**
   - Look for errors in `AuthScreen.tsx` when clicking "Continue with Google"
   - Check network requests to Supabase

2. **Check Server Logs**
   - Look for errors in `/auth/callback` route
   - Check for `AuthCallbackFatalError` or `AuthCallbackSessionError`

3. **Check Supabase Dashboard**
   - Authentication → Users → Check if user was created
   - Authentication → Logs → Check for auth events

4. **Check Network Tab**
   - Follow the OAuth redirect flow
   - Check if cookies are being set in response headers
   - Verify redirect URLs match configuration

5. **Test with curl/Postman**
   - Test `/auth/callback` endpoint directly with a code
   - Check response headers for cookies

---

## Auth Provider (Client-Side State Management)

### File: `components/providers/AuthProvider.tsx`

```typescript
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { normalizeRole, type UserRole } from "@/lib/utils/auth-utils";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => {
    if (typeof window === 'undefined') {
      return null; // SSR
    }
    return createBrowserClient(); // Singleton instance
  });
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("AuthProviderInitError", error);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          
          // Fetch user role from database
          const { data: userData, error: roleError } = await supabase
            .from("users")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (!roleError && userData?.role) {
            setRole(normalizeRole(userData.role));
          }
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (error) {
        console.error("AuthProviderError", error);
        setUser(null);
        setRole(null);
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);

      if (session?.user) {
        // Fetch updated role
        try {
          const { data: userData, error: roleError } = await supabase
            .from("users")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (!roleError && userData?.role) {
            setRole(normalizeRole(userData.role));
          }
        } catch (error) {
          console.error("AuthStateChangeRoleFetchException", error);
        }

        if (event === "SIGNED_IN") {
          setIsLoading(false);
          router.refresh();
        }
      } else {
        setRole(null);
        if (event === "SIGNED_OUT") {
          setIsLoading(false);
          router.push("/");
        }
      }

      if (event === "INITIAL_SESSION") {
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      router.push("/");
    } catch (error) {
      console.error("SignOutError", error);
    }
  };

  return (
    <AuthContext.Provider value={{ supabase, user, role, isLoading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
```

**Key Points:**
- Manages client-side auth state
- Listens to `onAuthStateChange` events
- Fetches user role from database
- Provides `useAuth()` hook for components

---

## Error Handling

### File: `app/auth/error/page.tsx`

This page displays user-friendly error messages for various authentication failures:
- Rate limiting errors
- Callback errors
- Session errors
- OAuth errors

**Error Types:**
- `rate_limit`: Too many requests
- `callback_error`: Error during callback processing
- `code_exchange`: Failed to exchange code for session
- `no_session`: Session not found
- `no_auth_data`: Missing authentication data
- `handler_error`: Handler processing error
- OAuth errors from Google (passed via `code` and `desc` params)

---

## Files Summary

- **Client Initiation**: `components/auth/AuthScreen.tsx`
- **Callback Handler**: `app/auth/callback/route.ts`
- **Browser Client**: `lib/supabase/client.ts`
- **Server Client**: `lib/supabase/server/client.ts`
- **Middleware Client**: `lib/supabase/middleware/client.ts`
- **Middleware**: `middleware.ts`
- **Auth Config**: `lib/auth/config.ts`
- **Auth Utils**: `lib/utils/auth-utils.ts`
- **Auth Provider**: `components/providers/AuthProvider.tsx`
- **Auth Types**: `lib/auth/types.ts`
- **Error Page**: `app/auth/error/page.tsx`
- **Google Calendar**: `lib/google-calendar.ts` (separate from auth)

