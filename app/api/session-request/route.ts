import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";
import { emailQueue } from "@/lib/email/queue";

// GET: Fetch session requests for the dietitian
export async function GET(request: NextRequest) {
  try {
    // Log cookies for debugging
    const cookieHeader = request.headers.get("cookie") || "";
    console.log("SessionRequest GET - Cookie header present:", !!cookieHeader);
    if (cookieHeader) {
      const hasAuthCookie = cookieHeader.includes('sb-') || cookieHeader.includes('supabase');
      console.log("SessionRequest GET - Has Supabase cookie:", hasAuthCookie);
    }

    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
      console.log("SessionRequest GET - Authenticated dietitian:", dietitian.id);
    } catch (authError: any) {
      console.error("SessionRequest GET - Authentication error", {
        error: authError?.message,
        status: authError?.status,
        url: request.url,
        stack: authError?.stack,
      });
      const statusCode = authError?.status || (authError?.message?.includes("Unauthorized") ? 401 : 403);
      return NextResponse.json(
        { 
          error: authError?.message || "Authentication failed",
          details: authError?.message 
        },
        { status: statusCode }
      );
    }
    
    const dietitianId = dietitian.id;

    const supabaseAdmin = createAdminClientServer();
    
    // Fetch session requests for this dietitian
    // Try with foreign key join first, fallback to simple query if it fails
    let requests: any[] | null = null;
    let error: any = null;
    
    try {
      const result = await supabaseAdmin
      .from("session_requests")
      .select(`
        id,
        request_type,
        client_name,
        client_email,
        message,
        status,
        event_type_id,
        meal_plan_type,
        price,
        currency,
        original_booking_id,
        requested_date,
        created_at,
        event_types:id (
          id,
          title,
          price,
          currency,
          length
        )
      `)
      .eq("dietitian_id", dietitianId)
      .order("created_at", { ascending: false });
      
      requests = result.data;
      error = result.error;
    } catch (joinError: any) {
      console.warn("SessionRequest GET - Foreign key join failed, trying simple query:", joinError);
      // Fallback: fetch without foreign key join
      const simpleResult = await supabaseAdmin
        .from("session_requests")
        .select(`
          id,
          request_type,
          client_name,
          client_email,
          message,
          status,
          event_type_id,
          meal_plan_type,
          price,
          currency,
          original_booking_id,
          requested_date,
          created_at
        `)
        .eq("dietitian_id", dietitianId)
        .order("created_at", { ascending: false });
      
      requests = simpleResult.data;
      error = simpleResult.error;
      
      // If we have requests but no event_types data, fetch them separately
      if (requests && !error && requests.length > 0) {
        const eventTypeIds = requests
          .filter(r => r.event_type_id)
          .map(r => r.event_type_id);
        
        if (eventTypeIds.length > 0) {
          const { data: eventTypes } = await supabaseAdmin
            .from("event_types")
            .select("id, title, price, currency, length")
            .in("id", eventTypeIds);
          
          // Attach event types to requests
          if (eventTypes) {
            const eventTypesMap = new Map(eventTypes.map(et => [et.id, et]));
            requests = requests.map(req => ({
              ...req,
              event_types: req.event_type_id ? eventTypesMap.get(req.event_type_id) : null
            }));
          }
        }
      }
    }

    if (error) {
      console.error("SessionRequest GET - Error fetching session requests:", {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: "Failed to fetch session requests", details: error.message },
        { status: 500 }
      );
    }

    console.log(`SessionRequest GET - Returning ${requests?.length || 0} session requests for dietitian ${dietitianId}`);

    // Transform the data to match the expected format
    try {
    const formattedRequests = (requests || []).map((req: any) => {
      const request: any = {
        id: req.id,
        requestType: req.request_type,
        clientName: req.client_name,
        clientEmail: req.client_email,
        message: req.message,
        status: req.status,
        createdAt: req.created_at,
      };

      if (req.request_type === "CONSULTATION" && req.event_types) {
        request.eventType = {
          id: req.event_types.id,
          title: req.event_types.title,
        };
        request.price = req.event_types.price;
        request.currency = req.event_types.currency;
        request.duration = req.event_types.length;
      } else if (req.request_type === "MEAL_PLAN") {
        request.mealPlanType = req.meal_plan_type;
        request.price = req.price;
        request.currency = req.currency;
      } else if (req.request_type === "RESCHEDULE_REQUEST") {
        request.originalBookingId = req.original_booking_id;
      }

      if (req.requested_date) {
        request.requestedDate = req.requested_date;
      }

      return request;
    });

    return NextResponse.json({ requests: formattedRequests });
    } catch (formatError: any) {
      console.error("SessionRequest GET - Error formatting requests:", formatError);
      return NextResponse.json(
        { error: "Failed to format session requests", details: formatError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("SessionRequest GET - Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session requests", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a new session request
export async function POST(request: NextRequest) {
  try {
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      console.error("Session request API POST: Authentication error", {
        error: authError?.message,
        url: request.url,
      });
      const statusCode = authError?.message?.includes("Unauthorized") ? 401 : 403;
      return NextResponse.json(
        { 
          error: authError?.message || "Authentication failed",
          details: authError?.message 
        },
        { status: statusCode }
      );
    }
    
    const dietitianId = dietitian.id;

    const body = await request.json();
    const {
      requestType,
      clientName,
      clientEmail,
      message,
      eventTypeId,
      mealPlanType,
      price,
      currency,
      requestedDate, // Optional - only used if provided
    } = body;

    // Validate required fields
    if (!clientName || !clientEmail) {
      return NextResponse.json(
        { error: "Client name and email are required" },
        { status: 400 }
      );
    }

    if (requestType === "CONSULTATION") {
      if (!eventTypeId) {
        return NextResponse.json(
          { error: "Event type is required for consultation requests" },
          { status: 400 }
        );
      }
      // Verify event type belongs to this dietitian
      const supabaseAdmin = createAdminClientServer();
      const { data: eventType, error: eventError } = await supabaseAdmin
        .from("event_types")
        .select("id, user_id")
        .eq("id", eventTypeId)
        .single();

      if (eventError || !eventType || eventType.user_id !== dietitianId) {
        return NextResponse.json(
          { error: "Event type not found or does not belong to this dietitian" },
          { status: 404 }
        );
      }
    } else if (requestType === "MEAL_PLAN") {
      if (!mealPlanType) {
        return NextResponse.json(
          { error: "Meal plan type is required for meal plan requests" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid request type. Must be CONSULTATION or MEAL_PLAN" },
        { status: 400 }
      );
    }

    // Insert the session request
    const supabaseAdmin = createAdminClientServer();
    const insertData: any = {
      request_type: requestType,
      client_name: clientName,
      client_email: clientEmail,
      dietitian_id: dietitianId,
      message: message || null,
      status: "PENDING",
    };

    if (requestType === "CONSULTATION") {
      insertData.event_type_id = eventTypeId;
      if (requestedDate) {
        insertData.requested_date = requestedDate;
      }
    } else if (requestType === "MEAL_PLAN") {
      insertData.meal_plan_type = mealPlanType;
      insertData.price = price;
      insertData.currency = currency || "NGN";
    }

    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("session_requests")
      .insert(insertData)
      .select(`
        id,
        request_type,
        client_name,
        client_email,
        message,
        status,
        event_type_id,
        meal_plan_type,
        price,
        currency,
        requested_date,
        created_at,
        event_types:id (
          id,
          title,
          price,
          currency,
          length
        )
      `)
      .single();

    if (insertError) {
      console.error("Error creating session request:", insertError);
      return NextResponse.json(
        { error: "Failed to create session request", details: insertError.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedRequest: any = {
      id: newRequest.id,
      requestType: newRequest.request_type,
      clientName: newRequest.client_name,
      clientEmail: newRequest.client_email,
      message: newRequest.message,
      status: newRequest.status,
      createdAt: newRequest.created_at,
    };

    if (newRequest.request_type === "CONSULTATION" && newRequest.event_types) {
      formattedRequest.eventType = {
        id: newRequest.event_types.id,
        title: newRequest.event_types.title,
      };
      formattedRequest.price = newRequest.event_types.price;
      formattedRequest.currency = newRequest.event_types.currency;
      formattedRequest.duration = newRequest.event_types.length;
    } else if (newRequest.request_type === "MEAL_PLAN") {
      formattedRequest.mealPlanType = newRequest.meal_plan_type;
      formattedRequest.price = newRequest.price;
      formattedRequest.currency = newRequest.currency;
    }

    if (newRequest.requested_date) {
      formattedRequest.requestedDate = newRequest.requested_date;
    }

    // Send email notification to user
    try {
      const actionLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/user-dashboard`;
      await emailQueue.enqueue({
        to: clientEmail,
        subject: requestType === "MEAL_PLAN" 
          ? `New Meal Plan Request from ${dietitian.name || "Your Dietitian"}`
          : `New Consultation Request from ${dietitian.name || "Your Dietitian"}`,
        template: "session_request",
        data: {
          userName: clientName,
          requestType: requestType === "MEAL_PLAN" ? "meal plan" : "consultation",
          message: message || "",
          actionRequired: true,
          actionLink,
        },
      });
    } catch (emailError) {
      console.error("Error enqueueing session request email:", emailError);
      // Don't fail the request creation if email fails
    }

    return NextResponse.json(
      { request: formattedRequest, message: "Session request created successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating session request:", error);
    return NextResponse.json(
      { error: "Failed to create session request", details: error.message },
      { status: 500 }
    );
  }
}
