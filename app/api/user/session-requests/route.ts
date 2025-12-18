import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { formatDietitianName } from "@/lib/utils/dietitian-name";
import type { SessionRequestCreate, SessionRequest } from "@/lib/types/session-requests";
import { ValidationError, NotFoundError, logError, logInfo } from "@/lib/error-handling";

// GET: Fetch pending session requests for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userEmail = user.email;

    const normalizedEmail = userEmail.toLowerCase().trim();
    logInfo("Fetching session requests for user", { 
      userEmail, 
      normalizedEmail,
      userId: user.id 
    });

    const supabaseAdmin = createAdminClientServer();
    
    // Fetch session requests for this user - normalize email to lowercase
    const { data: requests, error } = await supabaseAdmin
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
        dietitian_id
      `)
      .eq("client_email", normalizedEmail)
      .in("status", ["PENDING", "RESCHEDULE_REQUESTED"])
      .order("created_at", { ascending: false });

    if (error) {
      logError(new Error(error.message), {
        userId: user.id,
        userEmail: normalizedEmail,
        errorCode: error.code,
        errorDetails: error.details,
        operation: "fetch_session_requests",
      });
      return NextResponse.json(
        { 
          error: "Failed to fetch session requests", 
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    logInfo("Found session requests", {
      count: requests?.length || 0,
      normalizedEmail,
      userId: user.id,
      requestIds: requests?.map((r: any) => r.id),
    });

    // Fetch related data separately if needed
    const requestsWithRelations = await Promise.all(
      (requests || []).map(async (req: any) => {
        const result: any = { ...req };

        // Fetch event type if exists
        if (req.event_type_id) {
          const { data: eventType } = await supabaseAdmin
            .from("event_types")
            .select("id, title, price, currency, length, slug, active")
            .eq("id", req.event_type_id)
            .single();
          
          if (eventType) {
            // Filter out old/deleted event types
            const oldSlugs = [
              'free-trial-consultation',
              '1-on-1-consultation-with-licensed-dietician'
            ];
            
            // Only include if it's active and not an old event type
            if (eventType.active && !oldSlugs.includes(eventType.slug)) {
              result.event_types = eventType;
            } else {
              // If it's an old event type, try to map it to the new one
              if (eventType.slug === '1-on-1-consultation-with-licensed-dietician') {
                // Try to find the new event type for this dietitian
                const { data: newEventType } = await supabaseAdmin
                  .from("event_types")
                  .select("id, title, price, currency, length")
                  .eq("user_id", req.dietitian_id)
                  .eq("slug", "1-on-1-nutritional-counselling-and-assessment")
                  .eq("active", true)
                  .single();
                
                if (newEventType) {
                  result.event_types = newEventType;
                } else {
                  // Skip this request if we can't find a replacement
                  result.skip = true;
                }
              } else {
                // For free trial, skip the request
                result.skip = true;
              }
            }
          }
        }

        // For meal plan requests, check if meal plan has been sent (has PDF)
        if (req.request_type === "MEAL_PLAN") {
          const { data: mealPlan } = await supabaseAdmin
            .from("meal_plans")
            .select("id, file_url, status, sent_at")
            .eq("session_request_id", req.id)
            .single();
          
          result.mealPlan = mealPlan ? {
            id: mealPlan.id,
            fileUrl: mealPlan.file_url,
            status: mealPlan.status,
            sentAt: mealPlan.sent_at,
            hasPdf: !!mealPlan.file_url,
          } : null;
        }

        // Fetch dietitian info
        if (req.dietitian_id) {
          const { data: dietitian } = await supabaseAdmin
            .from("users")
            .select("id, name, email")
            .eq("id", req.dietitian_id)
            .single();
          
          if (dietitian) {
            result.dietitian = dietitian;
          }
        }

        return result;
      })
    );

    // Filter out requests that reference old/deleted event types
    const validRequests = requestsWithRelations.filter((req: any) => !req.skip);
    
    // Transform the data to match the expected format
    const formattedRequests = (validRequests || []).map((req: any) => {
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

      if (req.dietitian) {
        request.dietitian = {
          id: req.dietitian.id,
          name: formatDietitianName(req.dietitian.name),
          email: req.dietitian.email,
        };
      }

      if (req.requested_date) {
        request.requestedDate = req.requested_date;
      }

      return request;
    });

    return NextResponse.json({ requests: formattedRequests });
  } catch (error: any) {
    console.error("Error fetching user session requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch session requests", details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create a session request for the authenticated user (e.g., after meal plan purchase)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userEmail = user.email;
    const userName = user.name || userEmail.split("@")[0];

    const body = await request.json() as SessionRequestCreate;
    const {
      dietitianId,
      requestType,
      mealPlanType,
      notes,
      paymentData,
      price,
      currency,
      packageName,
    } = body;

    logInfo("Creating session request", {
      userId: user.id,
      userEmail,
      dietitianId,
      requestType,
      mealPlanType: mealPlanType || packageName,
    });

    // Validate required fields
    if (!dietitianId) {
      throw new ValidationError("Dietitian ID is required");
    }

    if (requestType !== "MEAL_PLAN") {
      throw new ValidationError("Only MEAL_PLAN requests are supported for user-initiated requests");
    }

    const finalMealPlanType = mealPlanType || packageName;
    if (!finalMealPlanType) {
      throw new ValidationError("Meal plan type is required");
    }

    // Verify dietitian/therapist exists
    const supabaseAdmin = createAdminClientServer();
    const { data: dietitian, error: dietitianError } = await supabaseAdmin
      .from("users")
      .select("id, name, email, role")
      .eq("id", dietitianId)
      .in("role", ["DIETITIAN", "THERAPIST"])
      .single();

    if (dietitianError || !dietitian) {
      logError(new Error("Dietitian not found"), {
        userId: user.id,
        dietitianId,
        error: dietitianError?.message,
      });
      throw new NotFoundError("Dietitian not found or invalid");
    }

    // Get price from meal plan constants if not provided
    let finalPrice = price;
    let finalCurrency = currency || "NGN";
    
    if (!finalPrice) {
      try {
        const { MEAL_PLAN_PACKAGES } = await import("@/lib/constants/meal-plans");
        // Try to find by name first (since frontend sends packageName), then by id
        const mealPlanPackage = MEAL_PLAN_PACKAGES.find(
          pkg => pkg.name === finalMealPlanType || pkg.id === finalMealPlanType
        );
        if (mealPlanPackage) {
          finalPrice = mealPlanPackage.price;
          finalCurrency = mealPlanPackage.currency;
        }
      } catch (e) {
        console.warn("Could not load meal plan package for pricing:", e);
      }
    }

    // Create session request - normalize email to lowercase for consistency
    const insertData: any = {
      request_type: "MEAL_PLAN",
      client_name: userName,
      client_email: userEmail.toLowerCase().trim(),
      dietitian_id: dietitianId,
      meal_plan_type: finalMealPlanType,
      status: "PENDING",
      message: notes || `Meal Plan Purchase: ${finalMealPlanType}`,
      price: finalPrice || 0,
      currency: finalCurrency,
    };

    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from("session_requests")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      logError(new Error(insertError.message), {
        userId: user.id,
        dietitianId,
        mealPlanType: finalMealPlanType,
        errorCode: insertError.code,
        errorDetails: insertError.details,
        operation: "create_session_request",
      });
      return NextResponse.json(
        { 
          error: "Failed to create session request", 
          details: insertError.message 
        },
        { status: 500 }
      );
    }

    logInfo("Session request created successfully", {
      requestId: newRequest.id,
      userId: user.id,
      dietitianId,
      mealPlanType: finalMealPlanType,
      paymentReference: paymentData?.reference,
    });

    return NextResponse.json({ 
      success: true,
      request: newRequest 
    });
  } catch (error: any) {
    // Handle AppError instances
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    logError(error instanceof Error ? error : new Error(String(error)), {
      operation: "create_session_request",
    });

    return NextResponse.json(
      { 
        error: "Failed to create session request", 
        details: error?.message || "Unknown error" 
      },
      { status: 500 }
    );
  }
}
