import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";

// POST: Get user IDs by email addresses
export async function POST(request: NextRequest) {
  try {
    const dietitian = await requireDietitianFromRequest(request);

    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "emails array is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Normalize emails to lowercase for matching
    const normalizedEmails = emails.map((e: string) => e.toLowerCase().trim());
    
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .in("email", normalizedEmails);

    if (error) {
      console.error("Error fetching users by email:", error);
      return NextResponse.json(
        { error: "Failed to fetch users", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ users: users || [] });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching users by email:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error.message },
      { status: 500 }
    );
  }
}

