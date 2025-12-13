import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

// POST: User accepts reschedule request and selects new date/time
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { newDate, newTime } = body;

    if (!newDate || !newTime) {
      return NextResponse.json(
        { error: "New date and time are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Combine date and time
    const startTime = new Date(`${newDate}T${newTime}`);
    // Assume 45 minute duration for now
    const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);

    // TODO: In production, find the booking associated with this reschedule request
    // and update it with new date/time
    // For now, return success (mock)
    console.log(`User ${userId} accepted reschedule request ${id}`, {
      newStartTime: startTime.toISOString(),
      newEndTime: endTime.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Reschedule confirmed successfully (mock - database table not yet created)",
      booking: {
        id: `booking-${Date.now()}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error confirming reschedule:", error);
    return NextResponse.json(
      { error: "Failed to confirm reschedule", details: error.message },
      { status: 500 }
    );
  }
}
