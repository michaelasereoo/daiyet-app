import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Check if email exists in users table
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, email, role")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found" which is OK, but other errors are not
      console.error("Error checking email existence:", {
        error: checkError.message,
        code: checkError.code,
      });
      return NextResponse.json(
        { error: "Failed to check email", details: checkError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        exists: !!existingUser,
        role: existingUser?.role || null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in email check:", {
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: "Failed to check email",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
