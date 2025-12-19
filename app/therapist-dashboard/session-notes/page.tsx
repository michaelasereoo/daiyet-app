import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server/client";
import { createAdminClientServer } from "@/lib/supabase/server";
import SessionNotesPageClient from "./SessionNotesPageClient";

export default async function SessionNotesPage() {
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
      redirect("/therapist-login?redirect=/therapist-dashboard/session-notes");
    }

    // 2. Check user role and account status
    const supabaseAdmin = createAdminClientServer();
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role, account_status, name")
      .eq("id", user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Session Notes: User not found in database", {
        error: userError?.message,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/therapist-enrollment");
    }

    if (dbUser.role !== "THERAPIST") {
      console.error("Session Notes: User is not therapist", {
        role: dbUser.role,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      if (dbUser.role === "USER") {
        redirect("/user-dashboard");
      } else if (dbUser.role === "ADMIN") {
        redirect("/admin");
      } else {
        redirect("/");
      }
    }

    if (dbUser.account_status !== "ACTIVE") {
      console.error("Session Notes: Account not active", {
        status: dbUser.account_status,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });
      redirect("/account-status");
    }

    // 3. Fetch session notes
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
        client:users!session_notes_client_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq("therapist_id", dbUser.id)
      .order("session_date", { ascending: false });

    const notes = (notesData && !notesError ? notesData : []) as any[];

    // Separate pending and completed notes
    const pendingNotes = notes.filter((note: any) => note.status === "PENDING");
    const completedNotes = notes.filter(
      (note: any) => note.status === "COMPLETED"
    );

    // Get unique clients from completed notes
    const clientsMap = new Map();
    completedNotes.forEach((note: any) => {
      const clientId = note.client_id;
      if (!clientsMap.has(clientId)) {
        clientsMap.set(clientId, {
          id: clientId,
          name: note.client_name,
          email: note.client?.email || "",
          totalSessions: 0,
          lastSessionDate: null,
        });
      }
      const client = clientsMap.get(clientId);
      client.totalSessions += 1;
      const sessionDate = new Date(note.session_date);
      if (!client.lastSessionDate || sessionDate > client.lastSessionDate) {
        client.lastSessionDate = sessionDate;
      }
    });

    const clients = Array.from(clientsMap.values());

    return (
      <SessionNotesPageClient
        pendingNotes={pendingNotes}
        clients={clients}
        therapistName={dbUser.name || "Therapist"}
      />
    );
  } catch (error) {
    console.error("Session Notes: Server error", error);
    redirect("/therapist-login?redirect=/therapist-dashboard/session-notes");
  }
}

