import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET /api/debug/meal-plan-flow?requestId=...&storagePath=...&userEmail=...
// Returns diagnostics for the meal plan upload/send flow:
// - session_request (ownership/status/email)
// - meal_plan (linked by session_request_id and fallback by dietitian/user)
// - storage object presence (best-effort)
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
    const storagePath = searchParams.get("storagePath");
    const userEmailParam = searchParams.get("userEmail");

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId query parameter is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Step 1: session_request
    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, dietitian_id, request_type, status")
      .eq("id", requestId)
      .single();

    // Step 2: primary meal_plan lookup by session_request_id
    const { data: mealPlanByReq, error: mealPlanByReqError } = await supabaseAdmin
      .from("meal_plans")
      .select("id, session_request_id, file_url, file_name, status, sent_at, dietitian_id, user_id, package_name")
      .eq("session_request_id", requestId)
      .maybeSingle();

    // Step 3: fallback meal_plan lookup by dietitian + user (from email param or session_request email)
    let mealPlanFallback = null;
    let mealPlanFallbackError = null;
    let fallbackUserId: string | null = null;

    const emailToUse = userEmailParam || sessionRequest?.client_email;
    if (emailToUse) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", emailToUse.toLowerCase().trim())
        .maybeSingle();

      if (user) {
        fallbackUserId = user.id;
        const { data: altMealPlan, error: altErr } = await supabaseAdmin
          .from("meal_plans")
          .select("id, session_request_id, file_url, file_name, status, sent_at, dietitian_id, user_id, package_name")
          .eq("dietitian_id", dietitian.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        mealPlanFallback = altMealPlan || null;
        mealPlanFallbackError = altErr || null;
      }
    }

    // Step 4: storage check (best-effort)
    let storageInfo: any = null;
    if (storagePath) {
      const pathParts = storagePath.split("/");
      const prefix = pathParts.slice(0, -1).join("/");
      const filename = pathParts[pathParts.length - 1];
      const { data: listData, error: listError } = await supabaseAdmin.storage
        .from("meal-plans")
        .list(prefix, { limit: 100 });

      const found = listData?.find((f: any) => f.name === filename);
      storageInfo = {
        checkedPrefix: prefix || "",
        listed: !listError,
        error: listError?.message || null,
        found: !!found,
        size: found?.metadata?.size || found?.size || null,
        updated_at: found?.updated_at || null,
      };
    }

    return NextResponse.json({
      success: true,
      requestId,
      storagePath,
      data: {
        sessionRequest: sessionRequest || null,
        sessionRequestError: srError?.message || null,
        mealPlanByRequest: mealPlanByReq || null,
        mealPlanByRequestError: mealPlanByReqError?.message || null,
        mealPlanFallback: mealPlanFallback || null,
        mealPlanFallbackError: mealPlanFallbackError?.message || null,
        fallbackUserId,
        storage: storageInfo,
      },
    });
  } catch (error: any) {
    console.error("[DEBUG MEAL PLAN FLOW] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to debug meal plan flow", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

