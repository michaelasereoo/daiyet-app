import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UserDashboardLayoutClient from "./layout-client";

/**
 * Server-side layout that enforces USER role for user dashboard
 */
export default async function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    // Fetch user and role server-side
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/login");
    }

    // Fetch role from database - look up by (auth_user_id, role)
    const supabaseAdmin = createAdminClientServer();
    let { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role, id, auth_user_id")
      .eq("auth_user_id", user.id)
      .eq("role", "USER")
      .maybeSingle();

    // Fallback: try by id (for backward compatibility)
    if (userError || !dbUser) {
      const { data: userById, error: errorById } = await supabaseAdmin
        .from("users")
        .select("role, id, auth_user_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!errorById && userById) {
        if (userById.role !== "USER") {
          // User exists but with different role - redirect appropriately
          if (userById.role === "DIETITIAN") redirect("/dashboard");
          else if (userById.role === "THERAPIST") redirect("/therapist-dashboard");
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
      redirect("/login");
    }

    // Enforce USER role - redirect to appropriate dashboard if not USER
    if (dbUser.role !== "USER") {
      if (dbUser.role === "DIETITIAN") {
        redirect("/dashboard");
      } else if (dbUser.role === "THERAPIST") {
        redirect("/therapist-dashboard");
      } else if (dbUser.role === "ADMIN") {
        redirect("/admin");
      } else {
        redirect("/");
      }
    }

    // User has correct role, render the client layout
    return <UserDashboardLayoutClient>{children}</UserDashboardLayoutClient>;
  } catch (error) {
    console.error("UserDashboardLayout: Error", error);
    redirect("/login");
  }
}
