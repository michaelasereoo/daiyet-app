import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// GET: Fetch distinct users who have booked with the dietitian
export async function GET(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);
    const dietitianId = dietitian.id;
    
    if (!dietitianId) {
      return NextResponse.json(
        { clients: [] },
        { status: 200 }
      );
    }

    const supabaseAdmin = createAdminClientServer();
    
    // Fetch all bookings for this dietitian with user information
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("user:users!bookings_user_id_fkey(id, name, email)")
      .eq("dietitian_id", dietitianId);

    if (error) {
      console.error("Error fetching bookings for clients:", error);
      return NextResponse.json(
        { error: "Failed to fetch clients", details: error.message },
        { status: 500 }
      );
    }

    // Deduplicate users by user ID (keep first occurrence)
    const uniqueUsersMap = new Map<string, { id: string; name: string; email: string }>();
    
    bookings?.forEach((booking: any) => {
      const user = booking.user;
      if (user && user.id && !uniqueUsersMap.has(user.id)) {
        uniqueUsersMap.set(user.id, {
          id: user.id,
          name: user.name || "Unknown",
          email: user.email || "",
        });
      }
    });

    // Convert map to array and sort alphabetically by name
    const clients = Array.from(uniqueUsersMap.values()).sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ clients });
  } catch (error: any) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients", details: error.message },
      { status: 500 }
    );
  }
}
