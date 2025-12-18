import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getDevUserFromPath } from "@/lib/auth-helpers";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import MealPlanClient from "./MealPlanClient";

export default async function MealPlanPage() {
  try {
    // DEVELOPMENT MODE: Use hardcoded therapist user
    const devUser = getDevUserFromPath('/therapist-dashboard/meal-plan');
    if (devUser && devUser.role === 'THERAPIST') {
      return (
        <div className="min-h-screen bg-[#0a0a0a] flex">
          <DashboardSidebar />
          <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
            <MealPlanClient dietitianId={devUser.id} />
          </main>
        </div>
      );
    }

    // 1. Check authentication (server-side)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Meal Plan: No user found", {
        error: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
      redirect("/therapist-login?redirect=/therapist-dashboard/meal-plan");
    }

    // 2. Check user role and account status
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status, name, image")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Meal Plan: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/therapist-enrollment");
    }

    if (dbUser.role !== "THERAPIST") {
      console.error("Meal Plan: User is not therapist", {
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
      console.error("Meal Plan: Account not active", {
        status: dbUser.account_status,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/account-status");
    }

    // Note: Meal plans feature is not yet fully implemented in the database
    // This page is ready for when the meal_plans table is created
    // For now, it shows an empty state with proper authentication

    // Profile is now managed by AuthProvider context via dashboard layout
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
          <MealPlanClient dietitianId={dbUser.id} />
        </main>
      </div>
    );
  } catch (error) {
    console.error("Meal Plan: Server error", error);
    redirect("/therapist-login?redirect=/therapist-dashboard/meal-plan");
  }
}
