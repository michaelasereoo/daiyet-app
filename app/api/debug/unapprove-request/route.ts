import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// POST: Unapprove a session request (for debugging)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { requestId } = body;

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    console.log("[DEBUG UNAPPROVE] Unapproving request:", requestId);

    // Get current request status
    const { data: currentRequest, error: fetchError } = await supabaseAdmin
      .from("session_requests")
      .select("id, status, request_type, meal_plan_type")
      .eq("id", requestId)
      .eq("dietitian_id", dietitian.id)
      .single();

    if (fetchError || !currentRequest) {
      return NextResponse.json(
        { error: "Request not found", details: fetchError?.message },
        { status: 404 }
      );
    }

    console.log("[DEBUG UNAPPROVE] Current request:", currentRequest);

    // Update status to PENDING
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from("session_requests")
      .update({ status: "PENDING" })
      .eq("id", requestId)
      .eq("dietitian_id", dietitian.id)
      .select()
      .single();

    if (updateError) {
      console.error("[DEBUG UNAPPROVE] Error updating request:", updateError);
      return NextResponse.json(
        { error: "Failed to unapprove request", details: updateError.message },
        { status: 500 }
      );
    }

    console.log("[DEBUG UNAPPROVE] Request unapproved successfully:", updatedRequest);

    // Also check if there's a meal plan linked to this request
    const { data: mealPlan } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, status")
      .eq("session_request_id", requestId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: "Request unapproved successfully",
      request: updatedRequest,
      linkedMealPlan: mealPlan || null,
    });
  } catch (error: any) {
    console.error("[DEBUG UNAPPROVE] Unexpected error:", error);
    
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to unapprove request",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

