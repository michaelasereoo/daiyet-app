import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

/**
 * Check user status - auth user and database user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClientServer();

    // Check auth users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return NextResponse.json(
        { error: "Failed to list auth users", details: listError.message },
        { status: 500 }
      );
    }

    const authUser = authUsers.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!authUser) {
      return NextResponse.json({
        email,
        authUser: null,
        dbUser: null,
        status: "NO_AUTH_USER",
        message: "User has not signed in with Google yet. They need to sign in first.",
      });
    }

    // Check database user
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (dbError && dbError.code !== "PGRST116") {
      return NextResponse.json({
        email,
        authUser: {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          email_confirmed_at: authUser.email_confirmed_at,
        },
        dbUser: null,
        error: dbError.message,
        status: "ERROR",
      });
    }

    if (!dbUser) {
      return NextResponse.json({
        email,
        authUser: {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          email_confirmed_at: authUser.email_confirmed_at,
          metadata: authUser.user_metadata,
        },
        dbUser: null,
        status: "NO_DB_USER",
        message: "Auth user exists but no database record. Database record needs to be created.",
        canCreate: true,
      });
    }

    return NextResponse.json({
      email,
      authUser: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        email_confirmed_at: authUser.email_confirmed_at,
      },
      dbUser: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        account_status: dbUser.account_status,
        email_verified: dbUser.email_verified,
        created_at: dbUser.created_at,
        updated_at: dbUser.updated_at,
      },
      status: "OK",
      message: "User exists in both auth and database",
    });
  } catch (error: any) {
    console.error("Check user error:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
