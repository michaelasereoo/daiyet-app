import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getDevUserFromPath } from "@/lib/auth-helpers";
import SessionRequestClient from "./SessionRequestClient";

/**
 * Session Request Page - Server Component
 * 
 * This page handles server-side authentication and authorization before
 * rendering the client component. This ensures:
 * - User is authenticated
 * - User has DIETITIAN role
 * - User account is ACTIVE
 * - Profile data is available via AuthProvider context
 * 
 * RSC (React Server Component) requests are handled by middleware,
 * which allows them to pass through without blocking.
 */
export default async function SessionRequestPage() {
  try {
    // DEVELOPMENT MODE: Use hardcoded dietitian user
    const devUser = getDevUserFromPath('/dashboard/session-request');
    if (devUser && devUser.role === 'DIETITIAN') {
      return <SessionRequestClient />;
    }

    // 1. Check authentication (server-side)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Session Request: No user found", {
        error: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
      redirect("/dietitian-login?redirect=/dashboard/session-request");
    }

    // 2. Check user role and account status
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status, name, image")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Session Request: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/dietitian-enrollment");
    }

    if (dbUser.role !== "DIETITIAN") {
      console.error("Session Request: User is not dietitian", {
        role: dbUser.role,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      // Redirect based on role
      if (dbUser.role === "USER") {
        redirect("/user-dashboard");
      } else if (dbUser.role === "ADMIN") {
        redirect("/admin");
      } else {
        redirect("/");
      }
    }

    if (dbUser.account_status !== "ACTIVE") {
      console.error("Session Request: Account not active", {
        status: dbUser.account_status,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/account-status");
    }

    // Profile is now managed by AuthProvider context via dashboard layout
    // The layout fetches profile server-side and initializes AuthProvider
    return <SessionRequestClient />;
  } catch (error) {
    // Log full error details for debugging
    console.error("Session Request: Server error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    // Re-throw to trigger error boundary if it's an RSC fetch error
    // Otherwise redirect to login
    if (error instanceof Error && error.message.includes('fetch')) {
      throw error; // Let error boundary handle it
    }
    
    redirect("/dietitian-login?redirect=/dashboard/session-request");
  }
}
