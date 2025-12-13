import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// PUT: Update session request (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;

    const body = await request.json();
    const { status } = body;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Verify the session request belongs to this dietitian
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from("session_requests")
      .select("id, dietitian_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: "Session request not found" },
        { status: 404 }
      );
    }

    if (existingRequest.dietitian_id !== dietitianId) {
      return NextResponse.json(
        { error: "Forbidden: This session request does not belong to you" },
        { status: 403 }
      );
    }

    // Update the session request status
    const { error: updateError } = await supabaseAdmin
      .from("session_requests")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating session request:", updateError);
      return NextResponse.json(
        { error: "Failed to update session request", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Session request ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error("Error updating session request:", error);
    return NextResponse.json(
      { error: "Failed to update session request", details: error.message },
      { status: 500 }
    );
  }
}
