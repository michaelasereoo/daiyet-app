import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/debug/test-meal-plan-query?requestId=...
 * Test the exact query used in the stream endpoint
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId") || "e0fb3619-4384-44df-8cfe-f1c29baffae1";

    const supabaseAdmin = createAdminClientServer();

    // Get the session request
    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, dietitian_id, meal_plan_type, status, request_type")
      .eq("id", requestId)
      .single();

    if (srError || !sessionRequest) {
      return NextResponse.json({
        error: "Session request not found",
        requestId,
        error: srError?.message,
      }, { status: 404 });
    }

    // Test the exact query from stream endpoint
    const { data: mealPlan, error: mealPlanError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id")
      .eq("session_request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also try without limit to see all results
    const { data: allMealPlans, error: allError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, status, sent_at, user_id, dietitian_id")
      .eq("session_request_id", requestId);

    return NextResponse.json({
      success: true,
      requestId,
      sessionRequest: {
        id: sessionRequest.id,
        clientEmail: sessionRequest.client_email,
        dietitianId: sessionRequest.dietitian_id,
        mealPlanType: sessionRequest.meal_plan_type,
        status: sessionRequest.status,
      },
      queryResult: {
        found: !!mealPlan,
        mealPlan: mealPlan ? {
          id: mealPlan.id,
          sessionRequestId: mealPlan.session_request_id,
          fileUrl: mealPlan.file_url,
          hasFileUrl: !!mealPlan.file_url,
          status: mealPlan.status,
        } : null,
        error: mealPlanError?.message || null,
      },
      allMealPlans: {
        count: allMealPlans?.length || 0,
        mealPlans: allMealPlans?.map(mp => ({
          id: mp.id,
          sessionRequestId: mp.session_request_id,
          fileUrl: mp.file_url,
          hasFileUrl: !!mp.file_url,
        })) || [],
        error: allError?.message || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: "Failed to test query", 
        details: error.message,
      },
      { status: 500 }
    );
  }
}

