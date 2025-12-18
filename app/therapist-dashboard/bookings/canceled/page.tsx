import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import BookingsPageClient, {
  type Booking,
} from "../BookingsPageClient";

export default async function CanceledBookingsPage() {
  try {
    // 1. Check authentication (server-side)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Canceled Bookings: No user found", {
        error: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
      redirect("/therapist-login?redirect=/therapist-dashboard/bookings/canceled");
    }

    // 2. Check user role and account status
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Canceled Bookings: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/therapist-enrollment");
    }

    if (dbUser.role !== "THERAPIST") {
      console.error("Canceled Bookings: User is not therapist", {
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
      console.error("Canceled Bookings: Account not active", {
        status: dbUser.account_status,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/account-status");
    }

    const dietitianId = dbUser.id;

    // 3. Fetch canceled bookings
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select(
        `
        id,
        start_time,
        end_time,
        title,
        description,
        meeting_link,
        event_types:event_type_id (
          id,
          title,
          slug
        ),
        user:users!bookings_user_id_fkey (
          name,
          email
        )
      `
      )
      .eq("dietitian_id", dietitianId)
      .eq("status", "CANCELLED")
      .order("start_time", { ascending: false });

    // Transform bookings to match the expected format
    const bookings: Booking[] =
      bookingsData && !bookingsError
        ? bookingsData.map((b: any) => ({
            id: b.id,
            date: new Date(b.start_time),
            startTime: new Date(b.start_time),
            endTime: new Date(b.end_time),
            title: b.title || b.event_types?.title || "Consultation",
            eventTypeSlug: b.event_types?.slug || null,
            description: b.description || "",
            message: b.description,
            participants: [
              "You",
              b.user?.name || b.user?.email || "Client",
            ],
            meetingLink: b.meeting_link || undefined,
          }))
        : [];

    // 4. Pass data to client component
    return <BookingsPageClient bookings={bookings} type="canceled" />;
  } catch (error) {
    console.error("Canceled Bookings: Server error", error);
    redirect("/therapist-login?redirect=/therapist-dashboard/bookings/canceled");
  }
}
