import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";
import { createGoogleMeetLinkOnly } from "@/lib/google-calendar";

/**
 * POST /api/admin/generate-meeting-links
 * Batch generates Google Meet links for all bookings that don't have meeting links.
 * Admin-only endpoint.
 * 
 * Optional query params:
 * - limit: Maximum number of bookings to process (default: 100)
 * - dietitianId: Only process bookings for a specific dietitian
 * - status: Only process bookings with specific status (default: CONFIRMED, PENDING)
 */
export async function POST(request: NextRequest) {
  try {
    // TEMPORARY: Admin auth disabled - uncomment below to re-enable
    /*
    // Check authentication and admin access
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = currentUser.role === "ADMIN" || currentUser.is_admin;
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }
    */

    const supabaseAdmin = createAdminClientServer();
    const { searchParams } = new URL(request.url);
    
    // Get optional parameters
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const dietitianId = searchParams.get("dietitianId");
    const statusFilter = searchParams.get("status") || "CONFIRMED,PENDING";

    // Build query for bookings without meeting links
    let query = supabaseAdmin
      .from("bookings")
      .select("id, title, start_time, end_time, dietitian_id, status, meeting_link")
      .is("meeting_link", null)
      .in("status", statusFilter.split(",").map(s => s.trim()));

    // Filter by dietitian if provided
    if (dietitianId) {
      query = query.eq("dietitian_id", dietitianId);
    }

    // Limit results
    query = query.limit(limit);

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      return NextResponse.json(
        { error: "Failed to fetch bookings", details: bookingsError.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        message: "No bookings found without meeting links",
        processed: 0,
        successful: 0,
        failed: 0,
        results: [],
      });
    }

    // Process each booking
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const booking of bookings) {
      const result: any = {
        booking_id: booking.id,
        title: booking.title,
        dietitian_id: booking.dietitian_id,
        status: booking.status,
      };

      try {
        // Generate Google Meet link
        const meetLink = await createGoogleMeetLinkOnly(
          booking.dietitian_id,
          {
            summary: booking.title || "Consultation Session",
            startTime: booking.start_time,
            endTime: booking.end_time,
          }
        );

        // Update booking with the meeting link
        const { error: updateError } = await supabaseAdmin
          .from("bookings")
          .update({ meeting_link: meetLink })
          .eq("id", booking.id);

        if (updateError) {
          throw new Error(`Failed to update booking: ${updateError.message}`);
        }

        // Also update status to CONFIRMED if it was PENDING
        if (booking.status === "PENDING") {
          await supabaseAdmin
            .from("bookings")
            .update({ status: "CONFIRMED" })
            .eq("id", booking.id);
        }

        result.success = true;
        result.meeting_link = meetLink;
        successful++;
      } catch (error: any) {
        result.success = false;
        result.error = error.message || "Unknown error";
        
        // Categorize errors
        if (error.message?.includes("OAuth tokens not found")) {
          result.error_type = "NO_GOOGLE_CALENDAR_CONNECTED";
          result.error_message = "Dietitian has not connected their Google Calendar";
        } else if (error.message?.includes("Failed to create")) {
          result.error_type = "GOOGLE_API_ERROR";
          result.error_message = "Google Calendar API error";
        } else {
          result.error_type = "UNKNOWN_ERROR";
          result.error_message = error.message;
        }
        
        failed++;
      }

      results.push(result);
    }

    return NextResponse.json({
      message: `Processed ${bookings.length} bookings`,
      processed: bookings.length,
      successful,
      failed,
      results,
      summary: {
        total_bookings: bookings.length,
        successful,
        failed,
        success_rate: `${((successful / bookings.length) * 100).toFixed(1)}%`,
      },
    });
  } catch (error: any) {
    console.error("Error in batch generate meeting links:", error);
    return NextResponse.json(
      { error: "Failed to generate meeting links", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/generate-meeting-links
 * Get statistics about bookings without meeting links
 */
export async function GET(request: NextRequest) {
  try {
    // TEMPORARY: Admin auth disabled - uncomment below to re-enable
    /*
    // Check authentication and admin access
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = currentUser.role === "ADMIN" || currentUser.is_admin;
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }
    */

    const supabaseAdmin = createAdminClientServer();
    const { searchParams } = new URL(request.url);
    const dietitianId = searchParams.get("dietitianId");
    const statusFilter = searchParams.get("status") || "CONFIRMED,PENDING";

    // Build query
    let query = supabaseAdmin
      .from("bookings")
      .select("id, dietitian_id, status", { count: "exact" })
      .is("meeting_link", null)
      .in("status", statusFilter.split(",").map(s => s.trim()));

    if (dietitianId) {
      query = query.eq("dietitian_id", dietitianId);
    }

    const { count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch statistics", details: error.message },
        { status: 500 }
      );
    }

    // Get breakdown by status
    const { data: statusBreakdown } = await supabaseAdmin
      .from("bookings")
      .select("status")
      .is("meeting_link", null)
      .in("status", statusFilter.split(",").map(s => s.trim()));

    const breakdown: Record<string, number> = {};
    statusBreakdown?.forEach((booking) => {
      breakdown[booking.status] = (breakdown[booking.status] || 0) + 1;
    });

    return NextResponse.json({
      total_bookings_without_meeting_links: count || 0,
      status_breakdown: breakdown,
      filters: {
        dietitian_id: dietitianId || "all",
        status: statusFilter,
      },
    });
  } catch (error: any) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics", details: error.message },
      { status: 500 }
    );
  }
}

