import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import BookingsPageClient, {
  type Booking,
} from "../BookingsPageClient";

export default async function RecurringBookingsPage() {
  try {
    // TEMPORARY: Auth disabled for development - uncomment below to re-enable
    /*
    // 1. Check authentication (server-side)
    const supabase = await createServerComponentClient();
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      console.error("Recurring Bookings: No session found", authError);
      redirect("/dietitian-login?redirect=/dashboard/bookings/recurring");
    }

    // 2. Check user role and account status
    const supabaseAdmin = createAdminClientServer();
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("role, account_status")
      .eq("id", session.user.id)
      .single();

    if (userError || !user) {
      console.error("Recurring Bookings: User not found", userError);
      redirect("/dietitian-enrollment");
    }

    if (user.role !== "DIETITIAN") {
      console.error("Recurring Bookings: User is not dietitian", {
        role: user.role,
      });
      redirect("/");
    }

    if (user.account_status !== "ACTIVE") {
      console.error("Recurring Bookings: Account not active", {
        status: user.account_status,
      });
      redirect("/account-status");
    }
    */

    // TEMPORARY: Use michaelasereoo@gmail.com's user ID for development
    // This page doesn't fetch bookings yet, but keeping the pattern consistent
    const supabaseAdmin = createAdminClientServer();
    
    // Get the user ID for michaelasereoo@gmail.com (for future use)
    let dietitianId: string | null = null;
    try {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", "michaelasereoo@gmail.com")
        .eq("role", "DIETITIAN")
        .single();
      
      if (user) {
        dietitianId = user.id;
      }
    } catch (error) {
      console.warn("Recurring Bookings: Could not fetch dietitian ID", error);
    }

    // 3. For now, recurring bookings are empty (no recurring booking feature yet)
    // In the future, this would query a recurring_bookings table or similar
    let bookings: Booking[] = [];

    // 4. Pass data to client component
    return <BookingsPageClient bookings={bookings} type="recurring" />;
  } catch (error) {
    console.error("Recurring Bookings: Server error", error);
    // TEMPORARY: Don't redirect on error when auth is disabled
    // redirect("/dietitian-login?redirect=/dashboard/bookings/recurring");
    return <BookingsPageClient bookings={[]} type="recurring" />;
  }
}
