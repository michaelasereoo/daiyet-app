import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieHeader = request.headers.get("cookie") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          const match = cookieHeader.match(new RegExp(`(^| )${name}=([^;]+)`));
          return match ? decodeURIComponent(match[2]) : null;
        },
        set() {},
        remove() {},
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          error: "Not authenticated",
          authError: authError?.message 
        },
        { status: 401 }
      );
    }

    // Get user from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      authUser: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at,
        metadata: user.user_metadata,
      },
      dbUser: userData,
      errors: {
        auth: authError?.message,
        db: userError?.message,
      },
      role: userData?.role || "NOT_FOUND",
      shouldRedirectTo: userData?.role === "DIETITIAN" ? "/dashboard" : 
                        userData?.role === "ADMIN" ? "/admin" : 
                        userData?.role === "USER" ? "/user-dashboard" : 
                        "/dietitian-enrollment",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
