import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reference = searchParams.get("reference");
  const trxref = searchParams.get("trxref"); // Paystack also sends this
  
  // Use reference or trxref (they're the same)
  const paymentRef = reference || trxref;

  if (!paymentRef) {
    // No reference, redirect to booking page with error
    const errorUrl = new URL("/user-dashboard/book-a-call", request.url);
    errorUrl.searchParams.set("payment", "error");
    errorUrl.searchParams.set("message", encodeURIComponent("Payment reference missing"));
    return NextResponse.redirect(errorUrl);
  }

  // Check payment to determine redirect destination
  const supabaseAdmin = createAdminClientServer();
  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .select("metadata, booking_id")
    .eq("paystack_ref", paymentRef)
    .single();

  console.log("[CALLBACK] Payment lookup:", { 
    paymentRef, 
    hasPayment: !!payment, 
    error: paymentError?.message,
    metadata: payment?.metadata,
    bookingId: payment?.booking_id 
  });

  // Determine redirect URL based on payment metadata or booking_id
  // If no booking_id, it's likely a meal plan purchase
  let redirectPath = "/user-dashboard/book-a-call"; // Default to booking page
  
  if (payment) {
    // Check metadata first (if stored as JSONB)
    try {
      const metadata = typeof payment.metadata === 'string' 
        ? JSON.parse(payment.metadata) 
        : payment.metadata;
      
      if (metadata && metadata.requestType === "MEAL_PLAN") {
        redirectPath = "/user-dashboard/meal-plan";
        console.log("[CALLBACK] Redirecting to meal-plan (from metadata)");
      }
    } catch (e) {
      // Metadata might not be JSON, ignore
    }
    
    // Fallback: if no booking_id, assume it's a meal plan
    // Meal plan purchases don't have booking_id
    if (redirectPath === "/user-dashboard/book-a-call" && !payment.booking_id) {
      redirectPath = "/user-dashboard/meal-plan";
      console.log("[CALLBACK] Redirecting to meal-plan (no booking_id - likely meal plan)");
    }
  } else {
    console.warn("[CALLBACK] Payment not found, defaulting to book-a-call");
  }

  // Redirect to appropriate success page with reference
  const successUrl = new URL(redirectPath, request.url);
  successUrl.searchParams.set("payment", "success");
  successUrl.searchParams.set("reference", paymentRef);
  return NextResponse.redirect(successUrl);
}

