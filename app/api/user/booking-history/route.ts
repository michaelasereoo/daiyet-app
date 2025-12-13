import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// GET: Fetch user's booking history to determine available event types
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Fetch completed bookings with event types
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        status,
        event_types (
          id,
          title,
          slug
        )
      `)
      .eq("user_id", user.id)
      .in("status", ["CONFIRMED", "COMPLETED"]);

    if (error) {
      console.error("Error fetching booking history:", error);
      return NextResponse.json(
        { error: "Failed to fetch booking history", details: error.message },
        { status: 500 }
      );
    }

    // Extract unique event type slugs that user has booked
    const bookedEventTypes = new Set<string>();
    (bookings || []).forEach((booking: any) => {
      if (booking.event_types?.slug) {
        bookedEventTypes.add(booking.event_types.slug);
      }
    });

    return NextResponse.json({
      bookings: bookings || [],
      bookedEventTypes: Array.from(bookedEventTypes),
    });
  } catch (error: any) {
    console.error("Error in booking-history route:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking history", details: error.message },
      { status: 500 }
    );
  }
}

