import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * POST /api/user/disconnect-google-calendar
 * Disconnect Google Calendar by removing OAuth tokens
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClientServer();

    // Delete Google OAuth tokens
    const { error } = await supabaseAdmin
      .from("google_oauth_tokens")
      .delete()
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Error disconnecting Google Calendar:", error);
      return NextResponse.json(
        { error: "Failed to disconnect Google Calendar", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Google Calendar disconnected successfully",
    });
  } catch (error: any) {
    console.error("Error disconnecting Google Calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Google Calendar", details: error.message },
      { status: 500 }
    );
  }
}

