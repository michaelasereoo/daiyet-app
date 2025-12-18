import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";
import { createCalendarEventWithMeet } from "@/lib/google-calendar";

/**
 * POST /api/bookings/[id]/generate-meet-link
 * Generates a Google Meet link for an existing booking that doesn't have one.
 * Can be called by the dietitian or admin to retroactively create meeting links.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const supabaseAdmin = createAdminClientServer();

    // Get booking details with user and dietitian emails
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        *,
        user:users!bookings_user_id_fkey ( id, email, name ),
        dietitian:users!bookings_dietitian_id_fkey ( id, email, name )
      `)
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify user has access
    const isDietitian = booking.dietitian_id === currentUser.id;
    const isUser = booking.user_id === currentUser.id;
    const isAdmin = currentUser.role === "ADMIN" || currentUser.is_admin;

    if (!isDietitian && !isUser && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only booking user, dietitian or admin can generate meeting links" },
        { status: 403 }
      );
    }

    // Check if booking already has a meeting link
    if (booking.meeting_link) {
      return NextResponse.json(
        { 
          message: "Booking already has a meeting link",
          meeting_link: booking.meeting_link 
        },
        { status: 200 }
      );
    }

    // Check if booking is confirmed (only generate links for confirmed bookings)
    if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only generate meeting links for CONFIRMED or PENDING bookings" },
        { status: 400 }
      );
    }

    // Generate Google Meet link via calendar event (with attendee emails)
    let meetLink = "";
    const attendeeEmails = [
      booking.user?.email,
      booking.dietitian?.email,
    ].filter(Boolean) as string[];

    try {
      const { meetLink: link } = await createCalendarEventWithMeet(
        booking.dietitian_id,
        {
          summary: booking.title || "Consultation Session",
          description: booking.description || "",
          startTime: booking.start_time,
          endTime: booking.end_time,
          attendeeEmails,
        }
      );
      meetLink = link;
    } catch (error: any) {
      console.error("Failed to create Google Meet link:", error);
      
      // Check if it's a token issue
      if (error.message?.includes("OAuth tokens not found")) {
        return NextResponse.json(
          { 
            error: "Dietitian has not connected their Google Calendar. Please connect Google Calendar in settings first.",
            details: error.message 
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          error: "Failed to create Google Meet link",
          details: error.message 
        },
        { status: 500 }
      );
    }

    // Update booking with the meeting link
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ meeting_link: meetLink })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update booking with meeting link:", updateError);
      return NextResponse.json(
        { 
          error: "Failed to update booking",
          details: updateError.message 
        },
        { status: 500 }
      );
    }

    // Also update status to CONFIRMED if it was PENDING
    if (booking.status === "PENDING") {
      await supabaseAdmin
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", id);
    }

    return NextResponse.json({
      message: "Meeting link generated successfully",
      meeting_link: meetLink,
      booking_id: id,
    });
  } catch (error: any) {
    console.error("Error generating meeting link:", error);
    return NextResponse.json(
      { error: "Failed to generate meeting link", details: error.message },
      { status: 500 }
    );
  }
}

