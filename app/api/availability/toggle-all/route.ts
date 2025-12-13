import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// POST: Toggle all availability schedules on/off
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const supabaseAdmin = createAdminClientServer();

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 }
      );
    }

    // Update all availability schedules for this dietitian
    const { error } = await supabaseAdmin
      .from("availability_schedules")
      .update({ active: enabled })
      .eq("dietitian_id", dietitian.id);

    if (error) {
      console.error("Error toggling availability:", error);
      return NextResponse.json(
        { error: "Failed to toggle availability", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      enabled,
      message: enabled ? "All availability enabled" : "All availability disabled",
    });
  } catch (error: any) {
    console.error("Error in toggle-all route:", error);
    return NextResponse.json(
      { error: "Failed to toggle availability", details: error.message },
      { status: 500 }
    );
  }
}

// GET: Get current toggle state
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const supabaseAdmin = createAdminClientServer();

    // Check if any schedules are active
    const { data: schedules, error } = await supabaseAdmin
      .from("availability_schedules")
      .select("active")
      .eq("dietitian_id", dietitian.id)
      .limit(1);

    if (error) {
      console.error("Error fetching availability state:", error);
      return NextResponse.json(
        { error: "Failed to fetch availability state", details: error.message },
        { status: 500 }
      );
    }

    // If no schedules exist, default to enabled
    const enabled = schedules && schedules.length > 0 
      ? schedules.some(s => s.active !== false) 
      : true;

    return NextResponse.json({ enabled });
  } catch (error: any) {
    console.error("Error in toggle-all GET route:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability state", details: error.message },
      { status: 500 }
    );
  }
}

