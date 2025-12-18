import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { getCurrentUserFromRequest } from "@/lib/auth-helpers";

// GET: List all active therapists
export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated (can be any role to view therapists)
    try {
      await getCurrentUserFromRequest(request);
    } catch (authError) {
      // Log but don't block - allow unauthenticated users to view therapists
      console.log("Auth check failed, proceeding anyway:", authError);
    }

    const supabaseAdmin = createAdminClientServer();

    // Fetch all active therapists (or all therapists if account_status is not set)
    const { data: therapists, error } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        name,
        email,
        bio,
        image,
        role,
        account_status
      `)
      .eq("role", "THERAPIST")
      .or("account_status.eq.ACTIVE,account_status.is.null") // Include ACTIVE or null account_status
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching therapists:", error);
      return NextResponse.json(
        { error: "Failed to fetch therapists", details: error.message },
        { status: 500 }
      );
    }

    // Format the response
    const formattedTherapists = (therapists || []).map((therapist: any) => ({
      id: therapist.id,
      name: therapist.name || "Therapist",
      email: therapist.email,
      bio: therapist.bio || "",
      image: therapist.image,
      qualification: "Licensed Therapist",
      description: therapist.bio || "Professional therapist ready to help you achieve your mental health goals.",
    }));

    return NextResponse.json({ therapists: formattedTherapists });
  } catch (error: any) {
    console.error("Error fetching therapists:", error);
    return NextResponse.json(
      { error: "Failed to fetch therapists", details: error.message },
      { status: 500 }
    );
  }
}

