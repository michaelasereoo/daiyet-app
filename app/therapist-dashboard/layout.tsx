import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDevUserFromPath } from "@/lib/auth-helpers";
import { DashboardProfileInitializer } from "./DashboardProfileInitializer";

/**
 * Dashboard layout that fetches user profile server-side and initializes
 * the AuthProvider context. This ensures profile data is available immediately
 * without client-side fetching, preventing flickering and race conditions.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    // DEVELOPMENT MODE: Use hardcoded therapist user
    // For dev mode, check therapist-dashboard path
    const devUser = getDevUserFromPath('/therapist-dashboard') || getDevUserFromPath('/dashboard');
    if (devUser) {
      const initialProfile = {
        name: devUser.name || null,
        image: devUser.image || null,
      };
      return (
        <DashboardProfileInitializer initialProfile={initialProfile}>
          {children}
        </DashboardProfileInitializer>
      );
    }

    // Fetch user and profile server-side
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/therapist-login");
    }

    // Fetch profile from database - look up by (auth_user_id, role)
    const supabaseAdmin = createAdminClientServer();
    let { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("name, image, role, id, auth_user_id")
      .eq("auth_user_id", user.id)
      .eq("role", "THERAPIST")
      .maybeSingle();

    // Fallback: try by id (for backward compatibility)
    if (userError || !dbUser) {
      const { data: userById, error: errorById } = await supabaseAdmin
        .from("users")
        .select("name, image, role, id, auth_user_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!errorById && userById) {
        if (userById.role !== "THERAPIST") {
          // User exists but with different role - redirect appropriately
          if (userById.role === "DIETITIAN") redirect("/dashboard");
          else if (userById.role === "USER") redirect("/user-dashboard");
          else if (userById.role === "ADMIN") redirect("/admin");
          else redirect("/");
        }
        dbUser = userById;
        
        // Update auth_user_id if not set
        if (!dbUser.auth_user_id) {
          await supabaseAdmin
            .from("users")
            .update({ auth_user_id: user.id })
            .eq("id", dbUser.id);
        }
      } else {
        userError = errorById;
      }
    }

    if (userError || !dbUser) {
      redirect("/therapist-enrollment");
    }

    if (dbUser.role !== "THERAPIST") {
      if (dbUser.role === "USER") redirect("/user-dashboard");
      else if (dbUser.role === "ADMIN") redirect("/admin");
      else redirect("/");
    }

    // Prepare profile for context initialization
    const initialProfile = {
      name: dbUser.name || null,
      image: dbUser.image || null,
    };

    return (
      <DashboardProfileInitializer initialProfile={initialProfile}>
        {children}
      </DashboardProfileInitializer>
    );
  } catch (error) {
    console.error("DashboardLayout: Error", error);
    redirect("/therapist-login");
  }
}