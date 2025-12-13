import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

/**
 * Fix dietitian user - create or update database record for michaelasereoo@gmail.com
 */
export async function POST(request: NextRequest) {
  try {
    const email = "michaelasereoo@gmail.com";
    const supabaseAdmin = createAdminClientServer();

    // Check auth user
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
        success: false,
        error: "Auth user not found",
        message: `${email} needs to sign in with Google first at /dietitian-login`,
      }, { status: 404 });
    }

    // Check if database user exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    const userData = {
      id: authUser.id,
      email: email.toLowerCase(),
      name: authUser.user_metadata?.name || 
            authUser.user_metadata?.full_name || 
            "Michael Asere",
      role: "DIETITIAN",
      account_status: "ACTIVE",
      email_verified: authUser.email_confirmed_at || new Date().toISOString(),
      image: authUser.user_metadata?.avatar_url || 
             authUser.user_metadata?.picture || 
             null,
      updated_at: new Date().toISOString(),
      metadata: {
        provider: "google",
        created_via: "admin-fix-dietitian-endpoint",
      },
    };

    let result;
    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          role: "DIETITIAN",
          account_status: "ACTIVE",
          email: email.toLowerCase(),
          name: userData.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: "Failed to update user",
          details: updateError.message,
        }, { status: 500 });
      }

      result = {
        action: "updated",
        user: updatedUser,
      };
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          ...userData,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({
          success: false,
          error: "Failed to create user",
          details: createError.message,
        }, { status: 500 });
      }

      result = {
        action: "created",
        user: newUser,
      };
    }

    return NextResponse.json({
      success: true,
      email,
      message: `Database record ${result.action} successfully`,
      ...result,
      nextSteps: [
        "1. Sign in at /dietitian-login with this email",
        "2. You should be redirected to /dashboard",
        "3. If still having issues, check browser console for errors",
      ],
    });
  } catch (error: any) {
    console.error("Fix dietitian error:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
