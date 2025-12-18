import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";
import { emailQueue } from "@/lib/email/queue";
import dayjs from "dayjs";

// Retry helper for transient network/DNS errors
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Retry on DNS/network errors
      const isRetryable = 
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('network');
      
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(`⚠️ [Bookings API] Retryable error (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry non-retryable errors or on last attempt
      throw error;
    }
  }
  
  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [Bookings API] Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });
      return NextResponse.json(
        { error: 'Service configuration error', details: 'Database connection not configured' },
        { status: 500 }
      );
    }
    
    // Get authenticated user - this ensures booking user_id matches the auth user
    // getCurrentUserFromRequest will automatically create the user record if missing
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser || !currentUser.id) {
      console.error('❌ [Bookings API] No authenticated user or missing user ID', {
        hasUser: !!currentUser,
        userId: currentUser?.id,
      });
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: 'Please log in to create a booking. If you just signed in, please refresh the page and try again.' 
        },
        { status: 401 }
      );
    }
    
    console.log('[Bookings API] Authenticated user:', {
      userId: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    });
    
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
      
      // Try to find event type by ID first, then by slug (with retry for network errors)
      let eventTypeData = null;
      let eventTypeError = null;
      
      try {
        // First try by UUID (if eventTypeId looks like a UUID)
        if (eventTypeId && eventTypeId.length === 36 && eventTypeId.includes('-')) {
          const result = await retryWithBackoff(async () =>
            supabaseAdmin
              .from("event_types")
              .select("*")
              .eq("id", eventTypeId)
              .single()
          );
          eventTypeData = result.data;
          eventTypeError = result.error;
        }
        
        // If not found by UUID, try by slug
        if (!eventTypeData && eventTypeId) {
          const result = await retryWithBackoff(async () =>
            supabaseAdmin
              .from("event_types")
              .select("*")
              .eq("slug", eventTypeId)
              .single()
          );
          eventTypeData = result.data;
          eventTypeError = result.error;
        }
      } catch (networkError: any) {
        console.error("[Bookings API] Network error fetching event type:", {
          eventTypeId,
          error: networkError.message,
          code: networkError.code,
        });
        return NextResponse.json(
          { 
            error: "Database connection failed", 
            details: networkError.message || "Unable to connect to database. Please try again.",
            retryable: true
          },
          { status: 503 }
        );
      }

      if (eventTypeError || !eventTypeData) {
        console.error("[Bookings API] Event type not found:", { eventTypeId, error: eventTypeError?.message });
        return NextResponse.json({ error: "Event type not found", details: `eventTypeId: ${eventTypeId}` }, { status: 404 });
      }
      eventType = eventTypeData;
    } else {
      // Legacy flow - get from event type (with retry for network errors)
      let eventTypeData = null;
      let eventTypeError = null;
      
      try {
        // First try by UUID
        if (eventTypeId && eventTypeId.length === 36 && eventTypeId.includes('-')) {
          const result = await retryWithBackoff(async () =>
            supabaseAdmin
              .from("event_types")
              .select("*, users(*)")
              .eq("id", eventTypeId)
              .single()
          );
          eventTypeData = result.data;
          eventTypeError = result.error;
        }
        
        // If not found by UUID, try by slug
        if (!eventTypeData && eventTypeId) {
          const result = await retryWithBackoff(async () =>
            supabaseAdmin
              .from("event_types")
              .select("*, users(*)")
              .eq("slug", eventTypeId)
              .single()
          );
          eventTypeData = result.data;
          eventTypeError = result.error;
        }
      } catch (networkError: any) {
        console.error("[Bookings API] Network error fetching event type (legacy):", {
          eventTypeId,
          error: networkError.message,
          code: networkError.code,
        });
        return NextResponse.json(
          { 
            error: "Database connection failed", 
            details: networkError.message || "Unable to connect to database. Please try again.",
            retryable: true
          },
          { status: 503 }
        );
      }

      if (eventTypeError || !eventTypeData) {
        console.error("[Bookings API] Event type not found:", { eventTypeId, error: eventTypeError?.message });
        return NextResponse.json({ error: "Event type not found", details: `eventTypeId: ${eventTypeId}` }, { status: 404 });
      }
      eventType = eventTypeData;
      dietitian_id = eventType.user_id;
    }

    // Use the authenticated user - this ensures consistency with auth system
    // getCurrentUserFromRequest now automatically creates the user record if missing
    const user = currentUser;
    
    // Double-check that user exists in database before creating booking
    // This is a safety check to ensure the foreign key constraint will be satisfied
    if (!user || !user.id) {
      console.error("[Bookings API] Invalid user object:", { user, currentUser });
      return NextResponse.json(
        { error: "Invalid user", details: "User record is missing or invalid" },
        { status: 401 }
      );
    }
    
    // Verify user exists in database before proceeding
    // This ensures the foreign key constraint will be satisfied
    const { data: verifyUser, error: verifyError } = await supabaseAdmin
      .from("users")
      .select("id, email, role")
      .eq("id", user.id)
      .single();
    
    if (verifyError || !verifyUser) {
      console.error("[Bookings API] User verification failed before booking creation:", {
        userId: user.id,
        userEmail: user.email,
        error: verifyError?.message,
        code: verifyError?.code,
        details: verifyError?.details,
        hint: verifyError?.hint,
      });
      
      return NextResponse.json(
        { 
          error: "User record not found", 
          details: `User with ID ${user.id} does not exist in the database. This may happen if your account was just created. Please refresh the page and try again.` 
        },
        { status: 500 }
      );
    }
    
    console.log("[Bookings API] User verified successfully:", {
      userId: verifyUser.id,
      email: verifyUser.email,
    });

    // Validate eventType exists and has required fields
    if (!eventType || !eventType.id) {
      console.error("[Bookings API] Invalid eventType:", { eventType, eventTypeId });
      return NextResponse.json(
        { error: "Invalid event type", details: "Event type data is missing or invalid" },
        { status: 400 }
      );
    }

    // Validate dietitian_id
    const finalDietitianId = dietitian_id || eventType.user_id;
    if (!finalDietitianId) {
      console.error("[Bookings API] Missing dietitian_id:", { dietitianId, eventType });
      return NextResponse.json(
        { error: "Missing dietitian information", details: "Could not determine dietitian for this booking" },
        { status: 400 }
      );
    }

    // Calculate end time if not provided
    const startTimeDate = new Date(startTime);
    if (isNaN(startTimeDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start time", details: `startTime: ${startTime}` },
        { status: 400 }
      );
    }
    
    const durationMinutes = eventType.length || 30;
    const endTimeDate = endTime ? new Date(endTime) : new Date(startTimeDate.getTime() + durationMinutes * 60000);

    console.log("[Bookings API] Creating booking:", {
      title: eventType.title,
      event_type_id: eventType.id,
      user_id: user.id,
      dietitian_id: finalDietitianId,
      start_time: startTimeDate.toISOString(),
      end_time: endTimeDate.toISOString(),
    });

    // Create booking - use eventType.id (the actual UUID) not eventTypeId (which could be a slug)
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        title: eventType.title,
        description: userComplaint || notes,
        start_time: startTimeDate.toISOString(),
        end_time: endTimeDate.toISOString(),
        status: "PENDING",
        event_type_id: eventType.id,
        user_id: user.id,
        dietitian_id: finalDietitianId,
        user_age: userAge,
        user_occupation: userOccupation,
        user_medical_condition: userMedicalCondition,
        user_monthly_food_budget: userMonthlyFoodBudget,
        user_complaint: userComplaint,
      })
      .select()
      .single();

    if (bookingError) {
      console.error("[Bookings API] Database error creating booking:", {
        error: bookingError,
        code: bookingError.code,
        message: bookingError.message,
        details: bookingError.details,
        hint: bookingError.hint,
      });
      return NextResponse.json(
        { 
          error: "Failed to create booking", 
          details: bookingError.message || bookingError.details || "Database error occurred",
          code: bookingError.code,
        },
        { status: 500 }
      );
    }

    // Automatically create meal plan request if this is the meal plan event type
    if (eventType.slug === '1-on-1-nutritional-counselling-and-assessment-meal-plan') {
      try {
        const { error: mealPlanRequestError } = await supabaseAdmin
          .from("session_requests")
          .insert({
            request_type: "MEAL_PLAN",
            client_name: user.name || name,
            client_email: user.email || email,
            dietitian_id: dietitian_id || eventType.user_id,
            meal_plan_type: "7-day",
            price: 10000,
            currency: "NGN",
            status: "PENDING",
            message: "Auto-created from booking: " + eventType.title,
          });

        if (mealPlanRequestError) {
          console.error("Error creating automatic meal plan request:", mealPlanRequestError);
          // Don't fail the booking if meal plan request creation fails
        } else {
          console.log(`Automatic meal plan request created for booking ${booking.id}`);
        }
      } catch (mealPlanError) {
        console.error("Error creating automatic meal plan request:", mealPlanError);
        // Don't fail the booking if meal plan request creation fails
      }
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
      const { error: updateSessionRequestError } = await supabaseAdmin
        .from("session_requests")
        .update({ status: "APPROVED" })
        .eq("id", sessionRequestId);
      
      if (updateSessionRequestError) {
        console.error(`Failed to update session request ${sessionRequestId}:`, updateSessionRequestError);
      } else {
        console.log(`Session request ${sessionRequestId} approved for booking ${booking.id}`);
      }
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

    if (currentUser.role === "DIETITIAN" || currentUser.role === "THERAPIST") {
      // Dietitians/Therapists see their own bookings
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
