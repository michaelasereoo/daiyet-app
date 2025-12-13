import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Use proper server client from @supabase/ssr
    const supabase = await createClient();

    // Get current user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", enrolled: false },
        { status: 401 }
      );
    }

    // Check if user is enrolled (has DIETITIAN role)
    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClientServer();
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userError) {
      // PGRST116 = not found - user doesn't exist in DB yet
      if (userError.code === "PGRST116") {
        return NextResponse.json({ enrolled: false, role: null });
      }
      // Other errors
      console.error("Error checking enrollment:", userError);
      return NextResponse.json(
        { error: "Failed to check enrollment", enrolled: false },
        { status: 500 }
      );
    }

    const isEnrolled = userData?.role === "DIETITIAN";
    return NextResponse.json({
      enrolled: isEnrolled,
      role: userData?.role || null,
    });
  } catch (error: any) {
    console.error("Error in check-enrollment API:", error);
    console.error("Error stack:", error?.stack);
    return NextResponse.json(
      { 
        error: "Internal server error", 
        enrolled: false,
        message: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
