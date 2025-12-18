import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/debug/meal-plans-check
 * Check meal plans and their session_request_id linkage
 */
export async function GET(request: NextRequest) {
  try {
    // Allow in dev mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    const supabaseAdmin = createAdminClientServer();

    // Get all meal plans
    const { data: mealPlans, error: mealPlansError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, dietitian_id, user_id, file_url, status, created_at")
      .order("created_at", { ascending: false });

    if (mealPlansError) {
      return NextResponse.json(
        { error: "Failed to fetch meal plans", details: mealPlansError.message },
        { status: 500 }
      );
    }

    // Get the specific session request
    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, dietitian_id, meal_plan_type, status")
      .eq("id", "e0fb3619-4384-44df-8cfe-f1c29baffae1")
      .single();

    // Get user for the session request email
    let sessionRequestUser = null;
    if (sessionRequest) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .eq("email", sessionRequest.client_email.toLowerCase().trim())
        .maybeSingle();
      sessionRequestUser = user;
    }

    // Analyze meal plans
    const analysis = {
      totalMealPlans: mealPlans?.length || 0,
      unlinkedMealPlans: mealPlans?.filter(mp => !mp.session_request_id).length || 0,
      linkedMealPlans: mealPlans?.filter(mp => mp.session_request_id).length || 0,
      sessionRequest: sessionRequest ? {
        id: sessionRequest.id,
        clientEmail: sessionRequest.client_email,
        dietitianId: sessionRequest.dietitian_id,
        mealPlanType: sessionRequest.meal_plan_type,
        status: sessionRequest.status,
        user: sessionRequestUser ? {
          id: sessionRequestUser.id,
          email: sessionRequestUser.email,
        } : null,
      } : null,
      mealPlans: mealPlans?.map(mp => ({
        id: mp.id,
        sessionRequestId: mp.session_request_id,
        dietitianId: mp.dietitian_id,
        userId: mp.user_id,
        hasFileUrl: !!mp.file_url,
        status: mp.status,
        createdAt: mp.created_at,
        matchesSessionRequest: mp.dietitian_id === sessionRequest?.dietitian_id,
        couldBeLinked: !mp.session_request_id && mp.dietitian_id === sessionRequest?.dietitian_id,
      })) || [],
    };

    return NextResponse.json({
      success: true,
      analysis,
      recommendations: {
        unlinkedMealPlansForDietitian: analysis.mealPlans.filter(mp => mp.couldBeLinked).length,
        shouldLink: analysis.mealPlans.filter(mp => mp.couldBeLinked).length > 0,
      },
    });
  } catch (error: any) {
    console.error("[MEAL PLANS CHECK] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to check meal plans", 
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

