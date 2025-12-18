import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "./supabase/server";
import type { NextRequest } from "next/server";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "DIETITIAN" | "ADMIN" | "THERAPIST";
  is_admin: boolean;
  bio: string | null;
  image: string | null;
  account_status?: string;
  email_verified?: boolean;
  signup_source?: string | null;
}

// DEV MODE: Real database IDs for localhost testing
const DEV_DIETITIAN_ID = 'b900e502-71a6-45da-bde6-7b596cc14d88'; // Real dietitian ID from DB
const DEV_USER_ID = 'f8b5c6d7-8e9f-4a0b-1c2d-3e4f5a6b7c8d'; // Placeholder - will use real user if exists
const DEV_THERAPIST_ID = 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d'; // Placeholder therapist ID for dev mode

/**
 * DEVELOPMENT MODE: Bypass auth for localhost testing
 * Returns hardcoded users based on URL path or query param
 * - /therapist-dashboard/* -> Therapist
 * - /dashboard/* -> Dietitian (michaelasereoo@gmail.com)
 * - /user-dashboard/* -> User (michaelasereo@gmail.com)
 * - ?as=therapist, ?as=dietitian, or ?as=user -> Override based on param
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
    } else if (pathname?.startsWith('/therapist-dashboard')) {
      userType = 'therapist';
    } else if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin')) {
      userType = 'dietitian';
    } else if (pathname?.startsWith('/user-dashboard')) {
      userType = 'user';
    } else if (pathname?.startsWith('/api/')) {
      // For API routes, check referer to determine context
      // Also check for dietitian/therapist-specific API endpoints
      if (referer.includes('/therapist-dashboard') ||
          (referer.includes('/therapy') && pathname.includes('event-types'))) {
        userType = 'therapist';
      } else if (referer.includes('/dashboard') ||
          pathname.includes('event-types') ||
          pathname.includes('dietitian') ||
          pathname.includes('availability')) {
        userType = 'dietitian';
      }
    }

    if (userType === 'therapist') {
      // Return hardcoded therapist user
      return {
        id: DEV_THERAPIST_ID,
        email: 'therapist@example.com',
        name: 'Therapist (Dev)',
        role: 'THERAPIST',
        is_admin: false,
        bio: null,
        image: null,
        account_status: 'ACTIVE',
        email_verified: true,
      } as User;
    } else if (userType === 'dietitian' || userType === 'diet') {
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

  if (pathname.startsWith('/therapist-dashboard')) {
    return {
      id: DEV_THERAPIST_ID,
      email: 'therapist@example.com',
      name: 'Therapist (Dev)',
      role: 'THERAPIST',
      is_admin: false,
      bio: null,
      image: null,
      account_status: 'ACTIVE',
      email_verified: true,
    } as User;
  } else if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
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
    // Check if this is a public booking route - skip dev mode for public bookings
    let url: URL;
    try {
      if (request instanceof Request) {
        url = new URL(request.url);
      } else {
        const nextUrl = (request as any).nextUrl;
        if (nextUrl) {
          url = nextUrl;
        } else {
          url = new URL((request as any).url || 'http://localhost:3000');
        }
      }
    } catch (e) {
      url = new URL('http://localhost:3000');
    }
    
    const isPublicBooking = url.pathname.includes('/Dietitian/') || url.pathname.includes('/api/bookings');
    
    // Use the proper server client from @supabase/ssr
    // This automatically handles cookies from Next.js cookie store
    const supabase = await createClient();
    
    // First, try to get real authenticated user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    // If we have a real authenticated user, use it (skip dev mode)
    if (!authError && authUser) {
      console.log('[AUTH] Using real authenticated user:', authUser.email);
      // Continue with real auth flow below - use authUser as finalAuthUser
    } else {
      // No real auth user - check if we should use dev mode
      // Skip dev mode for public booking routes (they need real auth)
      if (!isPublicBooking) {
        const devUser = getDevUser(request);
        if (devUser) {
          // Verify dev user exists in database
          const supabaseAdmin = createAdminClientServer();
          const { data: existingDevUser } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", devUser.id)
            .single();

          if (existingDevUser) {
            console.log('[DEV MODE] Using hardcoded user:', devUser.email, devUser.role);
            return devUser;
          } else {
            console.warn('[DEV MODE] Dev user does not exist in database, skipping dev mode');
          }
        }
      }

      // No dev user and no real auth - return null
      if (authError || !authUser) {
        console.warn("getCurrentUserFromRequest: Auth error or no user", {
          error: authError?.message,
          errorCode: authError?.status,
          hasUser: !!authUser,
          url: request.url,
          isPublicBooking,
        });
        return null;
      }
    }
    
    // Use authUser as finalAuthUser (we already have it from above)
    // At this point, we've either:
    // 1. Got a real authenticated user (authUser is set)
    // 2. Returned early with dev user or null
    if (!authUser) {
      // This should never happen due to checks above, but TypeScript needs this
      return null;
    }
    const finalAuthUser = authUser;

    // Get user record from database
    const supabaseAdmin = createAdminClientServer();
    let { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", finalAuthUser.id)
      .single();

    // If user doesn't exist in database but exists in auth, create the user record
    // This handles cases where OAuth succeeded but database record creation failed or was delayed
    if ((error?.code === "PGRST116" || !user) && finalAuthUser) {
      console.info("getCurrentUserFromRequest: Creating missing user record", {
        userId: finalAuthUser.id,
        email: finalAuthUser.email,
        errorCode: error?.code,
      });
      
      const userMetadata = finalAuthUser.user_metadata || {};
      const googleImage = userMetadata.avatar_url || userMetadata.picture || userMetadata.image || null;
      
      const insertData = {
        id: finalAuthUser.id,
        email: finalAuthUser.email!,
        name: userMetadata.name || userMetadata.full_name || finalAuthUser.email!.split("@")[0],
        image: googleImage,
        role: "USER", // Default role, can be upgraded later
        account_status: "ACTIVE",
        email_verified: finalAuthUser.email_confirmed_at || null,
        last_sign_in_at: new Date().toISOString(),
        metadata: {
          provider: userMetadata.provider || "google",
          provider_id: userMetadata.provider_id,
        },
      };
      
      console.log("getCurrentUserFromRequest: Inserting user with data:", {
        id: insertData.id,
        email: insertData.email,
        name: insertData.name,
        role: insertData.role,
      });
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error("getCurrentUserFromRequest: User creation error details:", {
          userId: finalAuthUser.id,
          error: createError.message,
          code: createError.code,
          details: createError.details,
          hint: createError.hint,
          insertData,
        });
        
        // If insert fails (e.g., race condition), try fetching again
        if (createError.code === "23505") {
          // Unique constraint violation - user was created by another request
          console.info("getCurrentUserFromRequest: Race condition detected, fetching existing user");
          const { data: existingUser, error: fetchError } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", finalAuthUser.id)
            .single();
          
          if (existingUser) {
            user = existingUser;
            console.info("getCurrentUserFromRequest: Successfully fetched existing user after race condition");
          } else {
            console.error("getCurrentUserFromRequest: Failed to fetch user after race condition", {
              userId: finalAuthUser.id,
              fetchError: fetchError?.message,
            });
            return null;
          }
        } else {
          // For other errors, still try to fetch in case user was created
          console.warn("getCurrentUserFromRequest: Trying to fetch user despite creation error");
          const { data: existingUser } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", finalAuthUser.id)
            .single();
          
          if (existingUser) {
            user = existingUser;
            console.info("getCurrentUserFromRequest: User found after creation error");
          } else {
            console.error("getCurrentUserFromRequest: Failed to create user record and user doesn't exist", {
              userId: finalAuthUser.id,
              error: createError.message,
              code: createError.code,
            });
            return null;
          }
        }
      } else if (newUser) {
        user = newUser;
        console.info("getCurrentUserFromRequest: Successfully created user record", {
          userId: newUser.id,
          email: newUser.email,
          role: newUser.role,
        });
      } else {
        console.error("getCurrentUserFromRequest: No error but no user returned from insert");
        return null;
      }
    } else if (error || !user) {
      console.warn("getCurrentUserFromRequest: User not found in database", {
        userId: finalAuthUser?.id,
        error: error?.message,
        errorCode: error?.code,
        hasAuthUser: !!finalAuthUser,
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
export async function getUserRole(userId: string): Promise<"USER" | "DIETITIAN" | "ADMIN" | "THERAPIST" | null> {
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

    return user.role as "USER" | "DIETITIAN" | "ADMIN" | "THERAPIST";
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
 * Require dietitian or therapist role from request - returns user or throws error
 * This function is used for routes that both dietitians and therapists can access
 */
export async function requireDietitianFromRequest(request: Request): Promise<User> {
  const user = await requireAuthFromRequest(request);
  if (user.role !== "DIETITIAN" && user.role !== "THERAPIST") {
    const error = new Error("Forbidden: Therapist or Dietitian access required");
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
