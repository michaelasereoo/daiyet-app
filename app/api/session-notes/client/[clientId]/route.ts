import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * GET: Get all session notes for a specific client
 * Used for "View Client Details" feature
 * Only accessible by the therapist who owns the notes or the client themselves
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId } = await params;
    const supabaseAdmin = createAdminClientServer();

    let query = supabaseAdmin
      .from("session_notes")
      .select(`
        id,
        booking_id,
        therapist_id,
        client_id,
        client_name,
        session_number,
        session_date,
        session_time,
        therapist_name,
        location,
        patient_complaint,
        personal_history,
        family_history,
        presentation,
        formulation_and_diagnosis,
        treatment_plan,
        assignments,
        status,
        created_at,
        updated_at,
        completed_at,
        bookings (
          id,
          title,
          start_time,
          end_time,
          status as booking_status
        ),
        therapist:users!session_notes_therapist_id_fkey (
          id,
          name,
          email
        ),
        client:users!session_notes_client_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("client_id", clientId);

    // Filter based on user role
    if (currentUser.role === "THERAPIST") {
      // Therapists can only see notes for their own clients
      query = query.eq("therapist_id", currentUser.id);
    } else if (currentUser.role === "USER") {
      // Clients can only see their own notes
      if (clientId !== currentUser.id) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
    } else if (currentUser.role === "ADMIN") {
      // Admins can see all notes (no additional filter)
    } else {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Order by session number (ascending) to show chronological order
    query = query.order("session_number", { ascending: true });

    const { data: notes, error } = await query;

    if (error) {
      console.error("[Session Notes] Error fetching client notes:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch client session notes",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error: any) {
    console.error("[Session Notes] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

