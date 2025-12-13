import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Check authentication
    const currentUser = await getCurrentUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const supabaseAdmin = createAdminClientServer();

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this booking (either as user or dietitian)
    if (booking.user_id !== currentUser.id && booking.dietitian_id !== currentUser.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking", details: error.message },
      { status: 500 }
    );
  }
}
