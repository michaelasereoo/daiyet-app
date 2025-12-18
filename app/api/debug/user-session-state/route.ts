import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userEmail = user.email.toLowerCase().trim();

    const supabaseAdmin = createAdminClientServer();

    // 1. Get all session requests for this user
    const { data: sessionRequests, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select(`
        id,
        request_type,
        status,
        client_email,
        client_name,
        dietitian_id,
        event_type_id,
        meal_plan_type,
        price,
        currency,
        created_at,
        updated_at
      `)
      .eq("client_email", userEmail)
      .order("created_at", { ascending: false });

    // 2. Get all bookings for this user
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        title,
        status,
        start_time,
        end_time,
        meeting_link,
        event_type_id,
        dietitian_id,
        user_id,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // 3. Get all payments for this user's bookings
    const bookingIds = bookings?.map((b: any) => b.id) || [];
    const { data: payments, error: paymentsError } = bookingIds.length > 0
      ? await supabaseAdmin
          .from("payments")
          .select(`
            id,
            booking_id,
            amount,
            currency,
            status,
            paystack_ref,
            created_at
          `)
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    // 4. Get dietitian info for session requests
    const dietitianIds = [
      ...new Set([
        ...(sessionRequests?.map((sr: any) => sr.dietitian_id) || []),
        ...(bookings?.map((b: any) => b.dietitian_id) || []),
      ]),
    ];

    const { data: dietitians } = dietitianIds.length > 0
      ? await supabaseAdmin
          .from("users")
          .select("id, name, email")
          .in("id", dietitianIds)
      : { data: [] };

    // 5. Get event types for session requests
    const eventTypeIds = [
      ...new Set([
        ...(sessionRequests?.filter((sr: any) => sr.event_type_id).map((sr: any) => sr.event_type_id) || []),
        ...(bookings?.filter((b: any) => b.event_type_id).map((b: any) => b.event_type_id) || []),
      ]),
    ];

    const { data: eventTypes } = eventTypeIds.length > 0
      ? await supabaseAdmin
          .from("event_types")
          .select("id, title, slug")
          .in("id", eventTypeIds)
      : { data: [] };

    // Format the response
    const response = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      sessionRequests: (sessionRequests || []).map((sr: any) => ({
        id: sr.id,
        requestType: sr.request_type,
        status: sr.status,
        clientEmail: sr.client_email,
        clientName: sr.client_name,
        dietitian: dietitians?.find((d: any) => d.id === sr.dietitian_id),
        eventType: sr.event_type_id ? eventTypes?.find((et: any) => et.id === sr.event_type_id) : null,
        mealPlanType: sr.meal_plan_type,
        price: sr.price,
        currency: sr.currency,
        createdAt: sr.created_at,
        updatedAt: sr.updated_at,
      })),
      bookings: (bookings || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        status: b.status,
        startTime: b.start_time,
        endTime: b.end_time,
        meetingLink: b.meeting_link,
        eventType: b.event_type_id ? eventTypes?.find((et: any) => et.id === b.event_type_id) : null,
        dietitian: dietitians?.find((d: any) => d.id === b.dietitian_id),
        payment: payments?.find((p: any) => p.booking_id === b.id),
        createdAt: b.created_at,
      })),
      summary: {
        totalSessionRequests: sessionRequests?.length || 0,
        pendingSessionRequests: sessionRequests?.filter((sr: any) => sr.status === "PENDING").length || 0,
        approvedSessionRequests: sessionRequests?.filter((sr: any) => sr.status === "APPROVED").length || 0,
        totalBookings: bookings?.length || 0,
        confirmedBookings: bookings?.filter((b: any) => b.status === "CONFIRMED").length || 0,
        bookingsWithMeetingLinks: bookings?.filter((b: any) => b.meeting_link).length || 0,
        upcomingBookings: bookings?.filter((b: any) => {
          if (b.status !== "CONFIRMED") return false;
          const startTime = new Date(b.start_time);
          return startTime >= new Date();
        }).length || 0,
      },
      errors: {
        sessionRequests: srError?.message,
        bookings: bookingsError?.message,
        payments: paymentsError?.message,
      },
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug data", details: error.message },
      { status: 500 }
    );
  }
}

