import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

// POST: User rejects a session request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    const user = await requireAuthFromRequest(request);
    const userEmail = user.email;

    const supabaseAdmin = createAdminClientServer();

    // Verify the session request belongs to this user
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from("session_requests")
      .select("id, client_email, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json(
        { error: "Session request not found" },
        { status: 404 }
      );
    }

    if (existingRequest.client_email !== userEmail) {
      return NextResponse.json(
        { error: "Forbidden: This session request does not belong to you" },
        { status: 403 }
      );
    }

    // Update the session request status to REJECTED
    const { error: updateError } = await supabaseAdmin
      .from("session_requests")
      .update({ status: "REJECTED" })
      .eq("id", id);

    if (updateError) {
      console.error("Error rejecting session request:", updateError);
      return NextResponse.json(
        { error: "Failed to reject session request", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Request rejected successfully",
    });
  } catch (error: any) {
    console.error("Error rejecting request:", error);
    return NextResponse.json(
      { error: "Failed to reject request", details: error.message },
      { status: 500 }
    );
  }
}
