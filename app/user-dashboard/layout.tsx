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

    // Fetch role from database
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

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
