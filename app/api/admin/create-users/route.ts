import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

/**
 * Admin endpoint to create user records in the database
 * This matches existing auth users with database records
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClientServer();
    const body = await request.json();
    const { users } = body;

    if (!Array.isArray(users)) {
      return NextResponse.json(
        { error: "users must be an array" },
        { status: 400 }
      );
    }

    const results = [];

    for (const userData of users) {
      const { email, role, name } = userData;

      if (!email || !role) {
        results.push({
          email: email || "unknown",
          success: false,
          error: "Email and role are required",
        });
        continue;
      }

      try {
        // First, check if auth user exists
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          results.push({
            email,
            success: false,
            error: `Failed to list auth users: ${listError.message}`,
          });
          continue;
        }

        const authUser = authUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

        if (!authUser) {
          results.push({
            email,
            success: false,
            error: "Auth user not found. User must sign in with Google first to create auth account.",
          });
          continue;
        }

        // Check if database user already exists
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id, email, role")
          .eq("id", authUser.id)
          .single();

        if (existingUser) {
          // Update existing user
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from("users")
            .update({
              role: role.toUpperCase(),
              email: email.toLowerCase(),
              name: name || existingUser.name || authUser.user_metadata?.name || email.split("@")[0],
              account_status: "ACTIVE",
              updated_at: new Date().toISOString(),
            })
            .eq("id", authUser.id)
            .select()
            .single();

          if (updateError) {
            results.push({
              email,
              success: false,
              error: `Failed to update user: ${updateError.message}`,
            });
          } else {
            results.push({
              email,
              success: true,
              action: "updated",
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                role: updatedUser.role,
              },
            });
          }
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabaseAdmin
            .from("users")
            .insert({
              id: authUser.id,
              email: email.toLowerCase(),
              name: name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || email.split("@")[0],
              role: role.toUpperCase(),
              account_status: "ACTIVE",
              email_verified: authUser.email_confirmed_at || new Date().toISOString(),
              image: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {
                provider: "google",
                created_via: "admin-create-users-endpoint",
              },
            })
            .select()
            .single();

          if (createError) {
            results.push({
              email,
              success: false,
              error: `Failed to create user: ${createError.message}`,
            });
          } else {
            results.push({
              email,
              success: true,
              action: "created",
              user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
              },
            });
          }
        }
      } catch (error: any) {
        results.push({
          email,
          success: false,
          error: error?.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    });
  } catch (error: any) {
    console.error("Create users error:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
