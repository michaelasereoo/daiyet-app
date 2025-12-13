import { NextRequest, NextResponse } from "next/server";

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

  // Redirect to success page with reference
  // The success page will verify the payment and show booking details
  const successUrl = new URL("/user-dashboard/book-a-call", request.url);
  successUrl.searchParams.set("payment", "success");
  successUrl.searchParams.set("reference", paymentRef);
  return NextResponse.redirect(successUrl);
}

