import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

/**
 * PUT: Update session note (fill form)
 * Only the therapist who owns the note can update it
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only therapists can update notes
    if (currentUser.role !== "THERAPIST") {
      return NextResponse.json(
        { error: "Only therapists can update session notes" },
        { status: 403 }
      );
    }

    const { id: noteId } = await params;
    const body = await request.json();
    const {
      patient_complaint,
      personal_history,
      family_history,
      presentation,
      formulation_and_diagnosis,
      treatment_plan,
      assignments,
    } = body;

    const supabaseAdmin = createAdminClientServer();

    // First, verify the note exists and belongs to this therapist
    const { data: existingNote, error: fetchError } = await supabaseAdmin
      .from("session_notes")
      .select("id, therapist_id, status")
      .eq("id", noteId)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json(
        { error: "Session note not found" },
        { status: 404 }
      );
    }

    // Verify therapist owns this note
    if (existingNote.therapist_id !== currentUser.id) {
      return NextResponse.json(
        { error: "You can only update your own session notes" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {
      patient_complaint: patient_complaint || null,
      personal_history: personal_history || null,
      family_history: family_history || null,
      presentation: presentation || null,
      formulation_and_diagnosis: formulation_and_diagnosis || null,
      treatment_plan: treatment_plan || null,
      assignments: assignments || null,
      updated_at: new Date().toISOString(),
    };

    // Check if all required fields are filled
    const hasAllFields =
      patient_complaint &&
      personal_history &&
      family_history &&
      presentation &&
      formulation_and_diagnosis &&
      treatment_plan &&
      assignments;

    // If all fields are filled and note is still PENDING, mark as COMPLETED
    if (hasAllFields && existingNote.status === "PENDING") {
      updateData.status = "COMPLETED";
      updateData.completed_at = new Date().toISOString();
    }

    // Update the note
    const { data: updatedNote, error: updateError } = await supabaseAdmin
      .from("session_notes")
      .update(updateData)
      .eq("id", noteId)
      .select()
      .single();

    if (updateError) {
      console.error("[Session Notes] Error updating note:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update session note",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      note: updatedNote,
    });
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

/**
 * GET: Get a single session note by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUserFromRequest(request);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: noteId } = await params;
    const supabaseAdmin = createAdminClientServer();

    const { data: note, error } = await supabaseAdmin
      .from("session_notes")
      .select(`
        *,
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
      .eq("id", noteId)
      .single();

    if (error || !note) {
      return NextResponse.json(
        { error: "Session note not found" },
        { status: 404 }
      );
    }

    // Type assertion for note to access properties
    const noteData = note as any;

    // Verify access: therapist, client, or admin
    const hasAccess =
      currentUser.role === "ADMIN" ||
      (currentUser.role === "THERAPIST" && noteData.therapist_id === currentUser.id) ||
      (currentUser.role === "USER" && noteData.client_id === currentUser.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ note });
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

