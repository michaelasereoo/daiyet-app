import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "./supabase/server";
import type { NextRequest } from "next/server";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "DIETITIAN" | "ADMIN";
  is_admin: boolean;
  bio: string | null;
  image: string | null;
  account_status?: string;
  email_verified?: boolean;
}

// DEV MODE: Real database IDs for localhost testing
const DEV_DIETITIAN_ID = 'b900e502-71a6-45da-bde6-7b596cc14d88'; // Real dietitian ID from DB
const DEV_USER_ID = 'f8b5c6d7-8e9f-4a0b-1c2d-3e4f5a6b7c8d'; // Placeholder - will use real user if exists

/**
 * DEVELOPMENT MODE: Bypass auth for localhost testing
 * Returns hardcoded users based on URL path or query param
 * - /dashboard/* -> Dietitian (michaelasereoo@gmail.com)
 * - /user-dashboard/* -> User (michaelasereo@gmail.com)
 * - ?as=dietitian or ?as=user -> Override based on param
 */
function getDevUser(request: Request | NextRequest): User | null {
  // Only enable in development/localhost
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) return null;

  try {
    // Handle both Request and NextRequest objects
    let url: URL;
    if (request instanceof Request) {
      url = new URL(request.url);
      } else {
        // NextRequest has nextUrl property
        const nextUrl = (request as any).nextUrl;
        if (nextUrl) {
          url = nextUrl;
        } else {
          url = new URL((request as any).url || 'http://localhost:3000');
        }
      }
    
    const pathname = url.pathname;
    
    // Check for ?as= query param first (override)
    const asParam = url.searchParams?.get('as');
    
    // Check referer header for API routes to determine context
    let referer = '';
    try {
      referer = (request as any).headers?.get?.('referer') || '';
    } catch (e) {
      // Ignore header access errors
    }
    
    let userType = 'user'; // default
    
    if (asParam) {
      userType = asParam.toLowerCase();
    } else if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
      userType = 'dietitian';
    } else if (pathname?.startsWith('/user-dashboard')) {
      userType = 'user';
    } else if (pathname?.startsWith('/api/')) {
      // For API routes, check referer to determine context
      // Also check for dietitian-specific API endpoints
      if (referer.includes('/dashboard') || 
          pathname.includes('event-types') || 
          pathname.includes('dietitian') ||
          pathname.includes('availability')) {
        userType = 'dietitian';
      }
    }

    if (userType === 'dietitian' || userType === 'diet') {
      // Return hardcoded dietitian user with REAL database ID
      return {
        id: DEV_DIETITIAN_ID,
        email: 'michaelasereoo@gmail.com',
        name: 'Michael (Dietitian)',
        role: 'DIETITIAN',
        is_admin: false,
        bio: null,
        image: null,
        account_status: 'ACTIVE',
        email_verified: true,
      } as User;
    } else {
      // Return hardcoded regular user
      return {
        id: DEV_USER_ID,
        email: 'michaelasereo@gmail.com',
        name: 'Michael (User)',
        role: 'USER',
        is_admin: false,
        bio: null,
        image: null,
        account_status: 'ACTIVE',
        email_verified: true,
      } as User;
    }
  } catch (error) {
    // If URL parsing fails, default to user
    console.warn('[DEV MODE] Error parsing URL for dev user, defaulting to user:', error);
    return {
      id: DEV_USER_ID,
      email: 'michaelasereo@gmail.com',
      name: 'Michael (User)',
      role: 'USER',
      is_admin: false,
      bio: null,
      image: null,
      account_status: 'ACTIVE',
      email_verified: true,
    } as User;
  }
}

/**
 * Get dev user for server components (doesn't need Request object)
 * Determines role from pathname
 */
export function getDevUserFromPath(pathname: string): User | null {
  if (process.env.NODE_ENV !== 'development') return null;
  
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    return {
      id: DEV_DIETITIAN_ID,
      email: 'michaelasereoo@gmail.com',
      name: 'Michael (Dietitian)',
      role: 'DIETITIAN',
      is_admin: false,
      bio: null,
      image: null,
      account_status: 'ACTIVE',
      email_verified: true,
    } as User;
  } else if (pathname.startsWith('/user-dashboard')) {
    return {
      id: DEV_USER_ID,
      email: 'michaelasereo@gmail.com',
      name: 'Michael (User)',
      role: 'USER',
      is_admin: false,
      bio: null,
      image: null,
      account_status: 'ACTIVE',
      email_verified: true,
    } as User;
  }
  
  return null;
}

/**
 * Get the current authenticated user from the request (server-side API route)
 * FIXED: Now uses @supabase/ssr createClient which properly handles cookies
 * DEVELOPMENT: Bypasses auth in localhost with hardcoded users
 */
export async function getCurrentUserFromRequest(request: Request | NextRequest): Promise<User | null> {
  try {
    // DEVELOPMENT MODE: Return hardcoded user for localhost testing
    const devUser = getDevUser(request);
    if (devUser) {
      console.log('[DEV MODE] Using hardcoded user:', devUser.email, devUser.role);
      return devUser;
    }

    // Use the proper server client from @supabase/ssr
    // This automatically handles cookies from Next.js cookie store
    const supabase = await createClient();

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.warn("getCurrentUserFromRequest: Auth error or no user", {
        error: authError?.message,
        errorCode: authError?.status,
        hasUser: !!authUser,
        url: request.url,
      });
      return null;
    }

    // Get user record from database
    const supabaseAdmin = createAdminClientServer();
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error || !user) {
      console.warn("getCurrentUserFromRequest: User not found in database", {
        userId: authUser.id,
        error: error?.message,
      });
      return null;
    }

    return user as User;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Get user role from database
 */
export async function getUserRole(userId: string): Promise<"USER" | "DIETITIAN" | "ADMIN" | null> {
  try {
    const supabaseAdmin = createAdminClientServer();
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return null;
    }

    return user.role as "USER" | "DIETITIAN" | "ADMIN";
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

/**
 * Require authentication from request - returns user or throws error
 */
export async function requireAuthFromRequest(request: Request): Promise<User> {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    const error = new Error("Unauthorized: Authentication required");
    (error as any).status = 401;
    throw error;
  }
  return user;
}

/**
 * Require dietitian role from request - returns user or throws error
 */
export async function requireDietitianFromRequest(request: Request): Promise<User> {
  const user = await requireAuthFromRequest(request);
  if (user.role !== "DIETITIAN") {
    const error = new Error("Forbidden: Dietitian access required");
    (error as any).status = 403;
    throw error;
  }
  return user;
}

/**
 * Require admin role from request - returns user or throws error
 */
export async function requireAdminFromRequest(request: Request): Promise<User> {
  const user = await requireAuthFromRequest(request);
  if (user.role !== "ADMIN" && !user.is_admin) {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
