import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import SessionNotesPageClient from "./SessionNotesPageClient";

export default async function UserSessionNotesPage() {
  try {
    // 1. Check authentication (server-side)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Session Notes: No user found", {
        error: authError?.message,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      });
      redirect("/login?redirect=/user-dashboard/session-notes");
    }

    // 2. Check user role
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Session Notes: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/login");
    }

    if (dbUser.role !== "USER") {
      if (dbUser.role === "THERAPIST") {
        redirect("/therapist-dashboard/session-notes");
      } else if (dbUser.role === "DIETITIAN") {
        redirect("/dashboard");
      } else if (dbUser.role === "ADMIN") {
        redirect("/admin");
      } else {
        redirect("/");
      }
    }

    // 3. Fetch session notes for this user
    const { data: notesData, error: notesError } = await supabaseAdmin
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
        )
      `)
      .eq("client_id", dbUser.id)
      .order("session_date", { ascending: false });

    const notes = (notesData && !notesError ? notesData : []) as any[];

    return <SessionNotesPageClient notes={notes} />;
  } catch (error) {
    console.error("Session Notes: Server error", error);
    redirect("/login?redirect=/user-dashboard/session-notes");
  }
}

