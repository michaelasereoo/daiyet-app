import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// POST: Unapprove all approved meal plan requests (for debugging)
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

    const supabaseAdmin = createAdminClientServer();

    console.log("[DEBUG UNAPPROVE ALL] Unapproving all approved meal plan requests for dietitian:", dietitian.id);

    // Get all approved meal plan requests
    const { data: approvedRequests, error: fetchError } = await supabaseAdmin
      .from("session_requests")
      .select("id, status, request_type, meal_plan_type, client_email")
      .eq("dietitian_id", dietitian.id)
      .eq("request_type", "MEAL_PLAN")
      .eq("status", "APPROVED");

    if (fetchError) {
      console.error("[DEBUG UNAPPROVE ALL] Error fetching requests:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch requests", details: fetchError.message },
        { status: 500 }
      );
    }

    console.log("[DEBUG UNAPPROVE ALL] Found approved requests:", approvedRequests?.length || 0);

    if (!approvedRequests || approvedRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No approved meal plan requests found",
        unapprovedCount: 0,
      });
    }

    // Unapprove all of them
    const requestIds = approvedRequests.map(r => r.id);
    const { data: updatedRequests, error: updateError } = await supabaseAdmin
      .from("session_requests")
      .update({ status: "PENDING" })
      .eq("dietitian_id", dietitian.id)
      .eq("request_type", "MEAL_PLAN")
      .eq("status", "APPROVED")
      .select("id, status");

    if (updateError) {
      console.error("[DEBUG UNAPPROVE ALL] Error updating requests:", updateError);
      return NextResponse.json(
        { error: "Failed to unapprove requests", details: updateError.message },
        { status: 500 }
      );
    }

    console.log("[DEBUG UNAPPROVE ALL] Successfully unapproved requests:", updatedRequests?.length || 0);

    return NextResponse.json({
      success: true,
      message: `Successfully unapproved ${updatedRequests?.length || 0} meal plan request(s)`,
      unapprovedCount: updatedRequests?.length || 0,
      requestIds: requestIds,
      updatedRequests: updatedRequests,
    });
  } catch (error: any) {
    console.error("[DEBUG UNAPPROVE ALL] Unexpected error:", error);
    
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to unapprove requests",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

