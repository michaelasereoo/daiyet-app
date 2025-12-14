import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Create admin client directly for database operations
function getAdminClient() {
  if (!supabaseServiceKey) {
    console.error("[Paystack] SUPABASE_SERVICE_ROLE_KEY not configured");
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Parse body first
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr: any) {
      console.error("[Paystack Init] Body parse error:", parseErr.message);
      return NextResponse.json(
        { error: "Invalid request body", details: parseErr.message },
        { status: 400 }
      );
    }

    const { bookingId, amount, metadata } = body;

    if (!PAYSTACK_SECRET_KEY) {
      console.error("[Paystack Init] PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "PAYSTACK_SECRET_KEY not configured" },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Paystack Init] Supabase config missing", { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseAnonKey 
      });
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    // Get email from authenticated session (OAuth details)
    // Use the same pattern as debug/user route which works correctly
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Cookies are set via response headers
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || !user.email) {
      console.error("[Paystack Init] Auth failed:", { 
        authError: authError?.message, 
        hasUser: !!user, 
        hasEmail: !!user?.email,
        cookieCount: request.cookies.getAll().length 
      });
      return NextResponse.json(
        { error: "Authentication required. Please ensure you are logged in.", details: authError?.message },
        { status: 401 }
      );
    }

    // Use email from authenticated session (OAuth)
    const email = user.email;
    const name = user.user_metadata?.name || 
                 user.user_metadata?.full_name || 
                 user.email?.split("@")[0] || 
                 "User";

    if (!amount) {
      return NextResponse.json(
        { error: "amount is required" },
        { status: 400 }
      );
    }

    // Get callback URL
    const callbackUrl = process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/paystack/callback`
      : `${request.headers.get("origin") || "http://localhost:3000"}/api/paystack/callback`;

    // Initialize transaction with Paystack (amount expected in kobo)
    const initRes = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email, // From authenticated session (OAuth)
        amount: amount, // Already in kobo from client
        currency: "NGN",
        callback_url: callbackUrl, // Redirect back after payment
        metadata: {
          bookingId: bookingId || undefined,
          name: name, // From authenticated session (OAuth)
          ...metadata, // Merge additional metadata
        },
      }),
    });

    const initJson = await initRes.json();
    if (!initRes.ok || !initJson.status) {
      return NextResponse.json(
        { error: "Paystack initialization failed", details: initJson },
        { status: 502 }
      );
    }

    const { authorization_url, reference } = initJson.data;

    // Upsert payment record as pending (using admin client for RLS bypass)
    const adminClient = getAdminClient();
    if (adminClient) {
      await adminClient.from("payments").upsert(
        {
          paystack_ref: reference,
          booking_id: bookingId,
          amount,
          currency: "NGN",
          status: "PENDING",
        },
        { onConflict: "paystack_ref" }
      );
    } else {
      console.warn("[Paystack] No admin client available, skipping payment record");
    }

    return NextResponse.json({ authorization_url, reference });
  } catch (error: any) {
    console.error("Paystack init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Paystack", details: error.message },
      { status: 500 }
    );
  }
}
