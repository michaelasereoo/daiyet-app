import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * Debug endpoint to inspect session requests
 * GET /api/debug/session-requests
 * Returns all meal plan session requests for debugging
 */
export async function GET(request: NextRequest) {
  try {
    // In development, allow access even without authentication (for debugging)
    // In production, require admin authentication
    let user = null;
    try {
      user = await getCurrentUserFromRequest(request);
    } catch (error) {
      // In development, continue even if auth fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('[DEBUG] Could not get authenticated user, but allowing in development mode:', error);
      } else {
        throw error;
      }
    }

    // Only restrict in production
    if (process.env.NODE_ENV === 'production') {
      if (!user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: "Admin access required in production" },
          { status: 403 }
        );
      }
    }

    const supabaseAdmin = createAdminClientServer();

    // Get all meal plan requests
    const { data: allMealPlans, error } = await supabaseAdmin
      .from("session_requests")
      .select(`
        id,
        request_type,
        client_email,
        client_name,
        meal_plan_type,
        status,
        price,
        currency,
        created_at,
        dietitian_id,
        users!session_requests_dietitian_id_fkey(id, name, email)
      `)
      .eq("request_type", "MEAL_PLAN")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch session requests", details: error.message },
        { status: 500 }
      );
    }

    // Get email variations
    const { data: emailVariations } = await supabaseAdmin
      .from("session_requests")
      .select("client_email")
      .eq("request_type", "MEAL_PLAN");

    const uniqueEmails = [...new Set(
      (emailVariations || []).map((e: any) => e.client_email)
    )];

    return NextResponse.json({
      total: allMealPlans?.length || 0,
      requests: allMealPlans || [],
      emailVariations: uniqueEmails.map(email => ({
        original: email,
        normalized: email.toLowerCase().trim(),
      })),
      userEmail: user?.email || 'Not authenticated',
      userEmailNormalized: user?.email ? user.email.toLowerCase().trim() : null,
      userId: user?.id || null,
      userRole: user?.role || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch debug data", details: error.message },
      { status: 500 }
    );
  }
}

