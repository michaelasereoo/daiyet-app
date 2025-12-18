import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// GET: Debug endpoint to check meal plans for approved session requests
export async function GET(request: NextRequest) {
  try {
    // Allow in dev mode only
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    const user = await getCurrentUserFromRequest(request);
    if (!user || user.role !== 'DIETITIAN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClientServer();

    // Get all APPROVED meal plan requests for this dietitian
    const { data: approvedRequests, error: requestsError } = await supabaseAdmin
      .from("session_requests")
      .select("id, request_type, status, meal_plan_type, client_email")
      .eq("dietitian_id", user.id)
      .eq("request_type", "MEAL_PLAN")
      .eq("status", "APPROVED");

    if (requestsError) {
      return NextResponse.json({ error: "Failed to fetch requests", details: requestsError.message }, { status: 500 });
    }

    // Get ALL meal plans for this dietitian (to see if any exist without session_request_id)
    const { data: allMealPlans, error: allMealPlansError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, status, created_at, user_id, package_name")
      .eq("dietitian_id", user.id)
      .order("created_at", { ascending: false });

    // For each approved request, check if meal plan exists
    const results = await Promise.all(
      (approvedRequests || []).map(async (req: any) => {
        // Try by session_request_id
        const { data: mealPlan, error: mealPlanError } = await supabaseAdmin
          .from("meal_plans")
          .select("id, session_request_id, file_url, status, created_at, user_id, package_name")
          .eq("session_request_id", req.id)
          .maybeSingle();

        // If not found, try to find by user email and package name
        let altMealPlan = null;
        if (!mealPlan && !mealPlanError) {
          const { data: userData } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", req.client_email.toLowerCase().trim())
            .maybeSingle();
          
          if (userData) {
            const { data: alt } = await supabaseAdmin
              .from("meal_plans")
              .select("id, session_request_id, file_url, status, created_at, user_id, package_name")
              .eq("dietitian_id", user.id)
              .eq("user_id", userData.id)
              .eq("package_name", req.meal_plan_type || "")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            altMealPlan = alt;
          }
        }

        return {
          sessionRequestId: req.id,
          mealPlanType: req.meal_plan_type,
          clientEmail: req.client_email,
          mealPlanExists: !!mealPlan,
          mealPlanId: mealPlan?.id || null,
          fileUrl: mealPlan?.file_url || null,
          hasFileUrl: !!(mealPlan?.file_url && mealPlan.file_url.trim() !== ''),
          mealPlanStatus: mealPlan?.status || null,
          sessionRequestIdMatch: mealPlan?.session_request_id === req.id,
          error: mealPlanError ? mealPlanError.message : null,
          altMealPlanFound: !!altMealPlan,
          altMealPlanId: altMealPlan?.id || null,
          altMealPlanFileUrl: altMealPlan?.file_url || null,
          altMealPlanSessionRequestId: altMealPlan?.session_request_id || null,
        };
      })
    );

    return NextResponse.json({
      dietitianId: user.id,
      approvedMealPlanRequests: approvedRequests?.length || 0,
      totalMealPlans: allMealPlans?.length || 0,
      allMealPlans: allMealPlans?.map((mp: any) => ({
        id: mp.id,
        session_request_id: mp.session_request_id,
        file_url: mp.file_url,
        hasFileUrl: !!mp.file_url,
        package_name: mp.package_name,
      })) || [],
      results,
    });
  } catch (error: any) {
    console.error("Debug meal plan check error:", error);
    return NextResponse.json(
      { error: "Failed to check meal plans", details: error.message },
      { status: 500 }
    );
  }
}

