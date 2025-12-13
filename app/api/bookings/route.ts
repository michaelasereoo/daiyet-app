import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";
import { emailQueue } from "@/lib/email/queue";
import dayjs from "dayjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventTypeId,
      startTime,
      endTime,
      name,
      email,
      phone,
      notes,
      paystackRef,
      dietitianId,
      sessionRequestId,
      paymentData,
      userAge,
      userOccupation,
      userMedicalCondition,
      userMonthlyFoodBudget,
      userComplaint,
    } = body;

    const supabaseAdmin = createAdminClientServer();

    // Get event type to find dietitian
    let eventType;
    let dietitian_id;

    if (dietitianId) {
      // If dietitianId is provided (from pre-fill), use it
      dietitian_id = dietitianId;
      const { data: eventTypeData, error: eventTypeError } = await supabaseAdmin
        .from("event_types")
        .select("*")
        .eq("id", eventTypeId)
        .single();

      if (eventTypeError || !eventTypeData) {
        return NextResponse.json({ error: "Event type not found" }, { status: 404 });
      }
      eventType = eventTypeData;
    } else {
      // Legacy flow - get from event type
      const { data: eventTypeData, error: eventTypeError } = await supabaseAdmin
        .from("event_types")
        .select("*, users(*)")
        .eq("id", eventTypeId)
        .single();

      if (eventTypeError || !eventTypeData) {
        return NextResponse.json({ error: "Event type not found" }, { status: 404 });
      }
      eventType = eventTypeData;
      dietitian_id = eventType.user_id;
    }

    // Create or get user by email
    let { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (!user) {
      const { data: newUser, error: userError } = await supabaseAdmin
        .from("users")
        .insert({
          email,
          name,
          role: "USER",
          account_status: "ACTIVE",
        })
        .select()
        .single();

      if (userError) {
        return NextResponse.json(
          { error: "Failed to create user", details: userError.message },
          { status: 500 }
        );
      }
      user = newUser;
    }

    // Calculate end time if not provided
    const startTimeDate = new Date(startTime);
    const durationMinutes = eventType.length || 30;
    const endTimeDate = endTime ? new Date(endTime) : new Date(startTimeDate.getTime() + durationMinutes * 60000);

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        title: eventType.title,
        description: userComplaint || notes,
        start_time: startTimeDate.toISOString(),
        end_time: endTimeDate.toISOString(),
        status: "PENDING",
        event_type_id: eventTypeId,
        user_id: user.id,
        dietitian_id: dietitian_id || eventType.user_id,
        user_age: userAge,
        user_occupation: userOccupation,
        user_medical_condition: userMedicalCondition,
        user_monthly_food_budget: userMonthlyFoodBudget,
        user_complaint: userComplaint,
      })
      .select()
      .single();

    if (bookingError) {
      return NextResponse.json(
        { error: "Failed to create booking", details: bookingError.message },
        { status: 500 }
      );
    }

    // Create payment record if paystackRef or paymentData is provided
    if (paystackRef || paymentData) {
      await supabaseAdmin.from("payments").insert({
        amount: eventType.price || 0,
        currency: eventType.currency || "NGN",
        status: "SUCCESS",
        paystack_ref: paystackRef || paymentData?.transactionId,
        booking_id: booking.id,
      });
    }

    // Update session request status if sessionRequestId is provided
    if (sessionRequestId) {
      // TODO: Update session_requests table status to APPROVED
      console.log(`Session request ${sessionRequestId} approved for booking ${booking.id}`);
    }

    // Send booking confirmation email if payment was already successful
    if (paystackRef || paymentData) {
      try {
        // Get user and dietitian details for email
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("name, email")
          .eq("id", user.id)
          .single();

        const { data: dietitianData } = await supabaseAdmin
          .from("users")
          .select("name, email")
          .eq("id", dietitian_id)
          .single();

        if (userData?.email) {
          await emailQueue.enqueue({
            to: userData.email,
            subject: "Booking Confirmed - Your Consultation is Scheduled",
            template: "booking_confirmation",
            data: {
              userName: userData.name || "User",
              eventTitle: eventType.title || "Consultation",
              date: dayjs(startTime).format("MMMM D, YYYY"),
              time: dayjs(startTime).format("h:mm A"),
              meetingLink: "", // Will be updated when Google Calendar event is created
            },
          });
        }

        if (dietitianData?.email) {
          await emailQueue.enqueue({
            to: dietitianData.email,
            subject: "New Booking Confirmed",
            template: "booking_confirmation",
            data: {
              userName: dietitianData.name || "Dietitian",
              eventTitle: eventType.title || "Consultation",
              date: dayjs(startTime).format("MMMM D, YYYY"),
              time: dayjs(startTime).format("h:mm A"),
              meetingLink: "",
            },
          });
        }
      } catch (emailError) {
        console.error("Error enqueueing booking confirmation email:", emailError);
        // Don't fail the booking creation if email fails
      }
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking", details: error.message },
      { status: 500 }
    );
  }
}

// GET: Fetch bookings for authenticated user (dietitian or regular user)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClientServer();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const dietitianId = searchParams.get("dietitianId");

    let query = supabaseAdmin.from("bookings").select("*");

    if (currentUser.role === "DIETITIAN") {
      // Dietitians see their own bookings
      query = query.eq("dietitian_id", currentUser.id);
    } else {
      // Regular users see bookings they created
      query = query.eq("user_id", currentUser.id);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Filter by dietitian if provided (for users viewing specific dietitian)
    if (dietitianId && dietitianId !== "current" && currentUser.role === "USER") {
      query = query.eq("dietitian_id", dietitianId);
    }

    query = query.order("start_time", { ascending: false });

    const { data: bookings, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch bookings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings });
  } catch (error: any) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings", details: error.message },
      { status: 500 }
    );
  }
}
