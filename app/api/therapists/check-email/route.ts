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

    // Check if email exists with THERAPIST role
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("users")
      .select("id, email, role")
      .eq("email", email.toLowerCase().trim())
      .eq("role", "THERAPIST")
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

    // If account with (email, THERAPIST) exists, they can't enroll again
    // But they can enroll if they have a different role (e.g., USER or DIETITIAN)
    const isAlreadyTherapist = !!existingUser; // If we found a user, they're already a therapist
    const canEnroll = !isAlreadyTherapist; // Can enroll if not already a therapist
    
    // Check if they have a DIETITIAN account (separate check)
    const { data: dietitianAccount } = await supabaseAdmin
      .from("users")
      .select("id, email, role")
      .eq("email", email.toLowerCase().trim())
      .eq("role", "DIETITIAN")
      .maybeSingle();
    
    const isAlreadyDietitian = !!dietitianAccount;

    // Check if they have a USER account (separate check)
    const { data: userAccount } = await supabaseAdmin
      .from("users")
      .select("id, email, role")
      .eq("email", email.toLowerCase().trim())
      .eq("role", "USER")
      .maybeSingle();
    
    const hasUserAccount = !!userAccount;

    return NextResponse.json(
      {
        exists: !!existingUser,
        role: existingUser?.role || null,
        canEnroll, // true if user doesn't exist or has role="USER"
        isAlreadyTherapist,
        isAlreadyDietitian,
        hasUserAccount,
        message: isAlreadyTherapist 
          ? "This email is already registered as a therapist. Please login instead."
          : isAlreadyDietitian
          ? "This email is already registered as a dietitian."
          : hasUserAccount
          ? "This email exists but can be upgraded to therapist."
          : null,
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
