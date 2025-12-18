import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireDietitianFromRequest } from "@/lib/auth-helpers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET(request: NextRequest) {
  try {
    // TEMPORARY: Auth disabled for development - uncomment below to re-enable
    /*
    // Use NextRequest's cookies() method for proper cookie handling
    const cookieStore = request.cookies;
    
    // Build cookie header string for Supabase client
    const cookiePairs: string[] = [];
    cookieStore.getAll().forEach(cookie => {
      cookiePairs.push(`${cookie.name}=${cookie.value}`);
    });
    const cookieHeader = cookiePairs.join('; ');
    
    // Create Supabase client with proper cookie handling
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value || null;
        },
        set() {},
        remove() {},
      },
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: false,
      },
    });

    // Try getSession first (reads from cookies directly)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    let authUser = session?.user;

    // If we have a session but no user, try using the access token
    if (session && !authUser && session.access_token) {
      const {
        data: { user },
        error: tokenError,
      } = await supabase.auth.getUser(session.access_token);
      authUser = user || null;
    }

    // If still no user, try getUser without token (will use cookies)
    if (!authUser) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      
      authUser = user || null;
      
      if (!authUser) {
        // Log all cookie names for debugging
        const cookieNames = cookieStore.getAll().map(c => c.name);
        const supabaseCookies = cookieNames.filter(name => name.includes('sb-') || name.includes('supabase'));
        
        console.warn("Dashboard stats auth error:", {
          sessionError: sessionError?.message,
          authError: authError?.message,
          hasSession: !!session,
          hasAccessToken: !!session?.access_token,
          hasUser: !!authUser,
          cookieCount: cookieStore.size,
          allCookieNames: cookieNames,
          supabaseCookies: supabaseCookies,
        });
        
        return NextResponse.json(
          { 
            error: "Unauthorized",
            debug: process.env.NODE_ENV === 'development' ? {
              hasSession: !!session,
              hasAccessToken: !!session?.access_token,
              cookieCount: cookieStore.size,
              supabaseCookies: supabaseCookies,
            } : undefined
          },
          { status: 401 }
        );
      }
    }

    // Get user from database
    const supabaseAdmin = createAdminClientServer();
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser!.id)
      .single();

    if (userError || !user) {
      console.warn("Dashboard stats user not found:", {
        error: userError?.message,
        userId: authUser.id,
      });
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.role !== "DIETITIAN" && user.role !== "THERAPIST") {
      return NextResponse.json(
        { error: "Forbidden: Therapist or Dietitian access required" },
        { status: 403 }
      );
    }

    const dietitian = user;
    */

    // TEMPORARY: Skip auth - use michaelasereoo@gmail.com's user ID
    const supabaseAdmin = createAdminClientServer();
    
    // Get the user ID for michaelasereoo@gmail.com
    let dietitianId: string | null = null;
    try {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", "michaelasereoo@gmail.com")
        .eq("role", "DIETITIAN")
        .single();
      
      if (user) {
        dietitianId = user.id;
        console.log("Dashboard stats: Using dietitian ID:", dietitianId);
      } else {
        console.warn("Dashboard stats: michaelasereoo@gmail.com not found, showing all data");
      }
    } catch (error) {
      console.warn("Dashboard stats: Could not fetch dietitian ID, showing all data", error);
    }

    // Get total sessions (completed bookings)
    // Use dietitian_id filter if we found the user
    const totalSessionsQuery = supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "COMPLETED");
    
    if (dietitianId) {
      totalSessionsQuery.eq("dietitian_id", dietitianId);
    }
    
    const { count: totalSessions } = await totalSessionsQuery;

    // Get upcoming sessions (future confirmed bookings)
    const now = new Date().toISOString();
    const upcomingSessionsQuery = supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("status", "CONFIRMED")
      .gte("start_time", now);
    
    if (dietitianId) {
      upcomingSessionsQuery.eq("dietitian_id", dietitianId);
    }
    
    const { count: upcomingSessions } = await upcomingSessionsQuery;

    // Get total revenue (sum of successful payments)
    // Use dietitian_id filter if we found the user
    let paymentsQuery;
    if (dietitianId) {
      // If we have dietitian ID, filter payments by their bookings
      paymentsQuery = supabaseAdmin
        .from("payments")
        .select(
          `
          amount,
          bookings!inner(dietitian_id)
        `
        )
        .eq("status", "SUCCESS")
        .eq("bookings.dietitian_id", dietitianId);
    } else {
      // No dietitian ID, get all payments
      paymentsQuery = supabaseAdmin
        .from("payments")
        .select("amount")
        .eq("status", "SUCCESS");
    }
    
    const { data: payments, error: paymentsError } = await paymentsQuery;

    let totalRevenue = 0;
    if (!paymentsError && payments) {
      totalRevenue = payments.reduce((sum, payment) => {
        return sum + Number(payment.amount || 0);
      }, 0);
    }

    return NextResponse.json({
      stats: {
        totalSessions: totalSessions || 0,
        upcomingSessions: upcomingSessions || 0,
        totalRevenue: totalRevenue,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message.includes("Forbidden")) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Unauthorized" ? 401 : 403 }
      );
    }
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats", details: error.message },
      { status: 500 }
    );
  }
}
