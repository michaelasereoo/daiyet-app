import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
    // Fetch user and profile server-side
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/dietitian-login");
    }

    // Fetch profile from database
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("name, image, role")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      redirect("/dietitian-enrollment");
    }

    if (dbUser.role !== "DIETITIAN") {
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
    redirect("/dietitian-login");
  }
}