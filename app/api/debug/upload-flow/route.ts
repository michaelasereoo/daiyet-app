import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Debug endpoint to check the upload flow state
export async function GET(request: NextRequest) {
  try {
    // In dev mode, allow more lenient auth
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      if (process.env.NODE_ENV === 'development') {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        const devUser = await getCurrentUserFromRequest(request);
        if (devUser && devUser.role === 'DIETITIAN') {
          dietitian = devUser;
        } else {
          throw authError;
        }
      } else {
        throw authError;
      }
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId query parameter is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    console.log("[DEBUG UPLOAD FLOW] Checking upload flow for request:", requestId);

    // Step 1: Get the session request
    const { data: sessionRequest, error: reqError } = await supabaseAdmin
      .from("session_requests")
      .select("*")
      .eq("id", requestId)
      .eq("dietitian_id", dietitian.id)
      .single();

    if (reqError || !sessionRequest) {
      return NextResponse.json(
        { 
          error: "Session request not found",
          details: reqError?.message,
          step: "1 - Fetch Session Request",
        },
        { status: 404 }
      );
    }

    // Step 2: Get user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("email", sessionRequest.client_email?.toLowerCase().trim())
      .maybeSingle();

    // Step 3: Check for meal plans linked to this request
    const { data: mealPlanByRequestId, error: mealPlanError1 } = await supabaseAdmin
      .from("meal_plans")
      .select("*")
      .eq("session_request_id", requestId)
      .maybeSingle();

    // Step 4: Check for meal plans by dietitian_id and user_id (fallback)
    let mealPlanByUser: any = null;
    if (user) {
      const { data: altMealPlan, error: mealPlanError2 } = await supabaseAdmin
        .from("meal_plans")
        .select("*")
        .eq("dietitian_id", dietitian.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      mealPlanByUser = altMealPlan;
    }

    // Step 5: Check all meal plans for this dietitian and user
    let allMealPlans: any[] = [];
    if (user) {
      const { data: allPlans } = await supabaseAdmin
        .from("meal_plans")
        .select("*")
        .eq("dietitian_id", dietitian.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      allMealPlans = allPlans || [];
    }

    return NextResponse.json({
      success: true,
      debug: {
        step1_sessionRequest: {
          found: !!sessionRequest,
          data: sessionRequest,
          error: reqError?.message || null,
        },
        step2_user: {
          found: !!user,
          data: user,
          error: userError?.message || null,
        },
        step3_mealPlanByRequestId: {
          found: !!mealPlanByRequestId,
          data: mealPlanByRequestId,
          error: mealPlanError1?.message || null,
        },
        step4_mealPlanByUser: {
          found: !!mealPlanByUser,
          data: mealPlanByUser,
        },
        step5_allMealPlans: {
          count: allMealPlans.length,
          data: allMealPlans,
        },
        analysis: {
          sessionRequestStatus: sessionRequest.status,
          hasLinkedMealPlan: !!mealPlanByRequestId,
          hasMealPlanForUser: !!mealPlanByUser,
          mealPlanLinkedCorrectly: mealPlanByRequestId?.session_request_id === requestId,
          mealPlanHasFileUrl: !!(mealPlanByRequestId?.file_url || mealPlanByUser?.file_url),
        },
      },
    });
  } catch (error: any) {
    console.error("[DEBUG UPLOAD FLOW] Unexpected error:", error);
    
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to check upload flow",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

