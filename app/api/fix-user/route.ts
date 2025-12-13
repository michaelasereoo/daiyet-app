import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { createRouteHandlerClientFromRequest, getCookieHeader } from "@/lib/supabase/server";

/**
 * Diagnostic and fix endpoint for user record issues
 * This helps fix cases where auth user exists but database user doesn't
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, role } = body;

    const supabaseAdmin = createAdminClientServer();
    
    // Try to get user from current session if no email provided
    let authUser;
    if (!email) {
      // Get current session
      const cookieHeader = getCookieHeader(request);
      const supabase = createRouteHandlerClientFromRequest(cookieHeader);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        return NextResponse.json(
          { error: "Not authenticated. Please sign in or provide email." },
          { status: 401 }
        );
      }
      
      authUser = session.user;
    } else {
      // Get auth user by email from Supabase Auth
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        return NextResponse.json(
          { error: "Failed to list users", details: listError.message },
          { status: 500 }
        );
      }

      authUser = authUsers.users.find((u) => u.email === email);
    }

    if (!authUser) {
      return NextResponse.json(
        { 
          error: "User not found in authentication system",
          email,
          suggestion: "User may need to sign in with Google first"
        },
        { status: 404 }
      );
    }

    // Check if user exists in database
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (action === "check") {
      return NextResponse.json({
        authUser: {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          email_confirmed_at: authUser.email_confirmed_at,
        },
        dbUser: dbUser || null,
        dbError: dbError?.message || null,
        exists: !!dbUser,
        role: dbUser?.role || "NOT_FOUND",
        status: dbUser ? "OK" : "MISSING_DB_RECORD",
      });
    }

    if (action === "create") {
      if (dbUser) {
        return NextResponse.json({
          success: true,
          message: "User already exists in database",
          user: dbUser,
        });
      }

      // Create user record
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || 
                authUser.user_metadata?.full_name || 
                (authUser.email || "").split("@")[0],
          image: authUser.user_metadata?.avatar_url || 
                 authUser.user_metadata?.picture || 
                 null,
          role: "USER", // Default role - can be updated to DIETITIAN if needed
          account_status: "ACTIVE",
          email_verified: !!authUser.email_confirmed_at,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {
            provider: "google",
            created_via: "fix-user-endpoint",
          },
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Failed to create user", details: createError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "User record created successfully",
        user: newUser,
        note: "If this user should be a DIETITIAN, they need to complete enrollment or you can update the role manually in the database.",
      });
    }

    if (action === "update-role") {
      const { role } = body;
      
      if (!role || !["USER", "DIETITIAN", "ADMIN"].includes(role)) {
        return NextResponse.json(
          { error: "Invalid role. Must be USER, DIETITIAN, or ADMIN" },
          { status: 400 }
        );
      }

      if (!dbUser) {
        return NextResponse.json(
          { error: "User not found in database. Create user first." },
          { status: 404 }
        );
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          role: role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to update role", details: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `User role updated to ${role}`,
        user: updatedUser,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'check', 'create', or 'update-role'" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Fix user error:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
