import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/user/google-calendar-status
 * Check if the current user has Google Calendar connected
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClientServer();

    // Check if user has Google OAuth tokens
    const { data: tokenData, error } = await supabaseAdmin
      .from("google_oauth_tokens")
      .select("id, created_at, expires_at")
      .eq("user_id", currentUser.id)
      .single();

    if (error || !tokenData) {
      return NextResponse.json({
        connected: false,
        message: "Google Calendar not connected",
      });
    }

    // Check if token is expired
    const isExpired = new Date(tokenData.expires_at) <= new Date();

    return NextResponse.json({
      connected: true,
      expired: isExpired,
      connected_at: tokenData.created_at,
      expires_at: tokenData.expires_at,
    });
  } catch (error: any) {
    console.error("Error checking Google Calendar status:", error);
    return NextResponse.json(
      { error: "Failed to check status", details: error.message },
      { status: 500 }
    );
  }
}

