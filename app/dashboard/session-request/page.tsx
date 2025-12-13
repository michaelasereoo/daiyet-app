import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import SessionRequestClient from "./SessionRequestClient";

export default async function SessionRequestPage() {
  try {
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
    return <SessionRequestClient />;
  } catch (error) {
    console.error("Session Request: Server error", error);
    redirect("/dietitian-login?redirect=/dashboard/session-request");
  }
}
