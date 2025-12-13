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

/**
 * Get the current authenticated user from the request (server-side API route)
 * FIXED: Now uses @supabase/ssr createClient which properly handles cookies
 */
export async function getCurrentUserFromRequest(request: Request | NextRequest): Promise<User | null> {
  try {
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
