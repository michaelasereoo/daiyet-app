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

    // Fetch profile from database
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("name, image, role")
      .eq("id", user.id)
      .single();

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