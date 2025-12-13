"use server";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export async function POST(request: NextRequest) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "PAYSTACK_SECRET_KEY not configured" },
        { status: 500 }
      );
    }

    const { bookingId, amount, email, name, metadata } = await request.json();

    if (!amount || !email) {
      return NextResponse.json(
        { error: "amount and email are required" },
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
        email,
        amount: amount, // Already in kobo from client
        currency: "NGN",
        callback_url: callbackUrl, // Redirect back after payment
        metadata: {
          bookingId: bookingId || undefined,
          name: name || undefined,
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

    // Upsert payment record as pending
    await supabaseAdmin.from("payments").upsert(
      {
        paystack_ref: reference,
        booking_id: bookingId,
        amount,
        currency: "NGN",
        status: "PENDING",
      },
      { onConflict: "paystack_ref" }
    );

    return NextResponse.json({ authorization_url, reference });
  } catch (error: any) {
    console.error("Paystack init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Paystack", details: error.message },
      { status: 500 }
    );
  }
}
