import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET /api/debug/meal-plan-send?requestId=...
// Shows session_request + meal_plan linkage and status
export async function GET(request: NextRequest) {
  try {
    // Auth: allow dev fallback
    let dietitian;
    try {
      dietitian = await requireDietitianFromRequest(request);
    } catch (authError: any) {
      if (process.env.NODE_ENV === "development") {
        const { getCurrentUserFromRequest } = await import("@/lib/auth-helpers");
        const devUser = await getCurrentUserFromRequest(request);
        if (devUser && devUser.role === "DIETITIAN") {
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

    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, dietitian_id, request_type, status, meal_plan_type")
      .eq("id", requestId)
      .single();

    const { data: mealPlan, error: mpError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, file_name, status, sent_at, user_id, dietitian_id, package_name")
      .eq("session_request_id", requestId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      requestId,
      data: {
        sessionRequest,
        sessionRequestError: srError?.message || null,
        mealPlan,
        mealPlanError: mpError?.message || null,
      },
    });
  } catch (error: any) {
    console.error("[DEBUG MEAL PLAN SEND] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to debug meal plan send", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

