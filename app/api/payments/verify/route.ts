import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createGoogleMeetLinkOnly } from "@/lib/google-calendar";

// Fallback function if Google Calendar API fails
function generateFallbackMeetLink(reference: string) {
  const slug = reference.slice(-8);
  return `https://meet.google.com/${slug}`;
}

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json(
        { error: "Reference is required" },
        { status: 400 }
      );
    }

    // Find payment by Paystack reference
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*, bookings(*)")
      .eq("paystack_ref", reference)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Update payment status
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ status: "SUCCESS" })
      .eq("id", payment.id)
      .select("*, booking_id")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update payment", details: updateError.message },
        { status: 500 }
      );
    }

    // Get booking details
    let booking = null;
    if (payment.booking_id) {
      const { data: bookingData, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", payment.booking_id)
        .single();
      
      if (!bookingError && bookingData) {
        booking = bookingData;
      }
    }
    
    if (booking) {
      // ALWAYS confirm booking first - this is the critical step
      const { error: confirmError } = await supabaseAdmin
        .from("bookings")
        .update({ status: "CONFIRMED" })
        .eq("id", payment.booking_id);

      if (confirmError) {
        console.error("Failed to confirm booking:", confirmError);
      } else {
        console.log("Booking confirmed successfully:", payment.booking_id);
      }

      // Then try to create/update meeting link (best effort - don't block on failure)
      if (!booking.meeting_link) {
        let meetLink = "";

        // Try to create Google Meet link (minimal calendar event, no attendees)
        try {
          meetLink = await createGoogleMeetLinkOnly(
            booking.dietitian_id,
            {
              summary: booking.title || "Consultation Session",
              startTime: booking.start_time,
              endTime: booking.end_time,
            }
          );
          console.log("Google Meet link created:", meetLink);
        } catch (error) {
          console.error("Failed to create Google Meet link:", error);
          // Fallback to placeholder Meet link
          meetLink = generateFallbackMeetLink(reference);
          console.log("Using fallback Meet link:", meetLink);
        }

        // Update booking with meeting link (booking is already CONFIRMED)
        const { error: meetLinkError } = await supabaseAdmin
          .from("bookings")
          .update({ meeting_link: meetLink })
          .eq("id", payment.booking_id);

        if (meetLinkError) {
          console.error("Failed to add meeting link to booking:", meetLinkError);
          // Don't throw - booking is still confirmed
        }
      }
    }

    // Fetch the updated booking to include in response
    let updatedBooking = null;
    if (payment.booking_id) {
      const { data: bookingData } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", payment.booking_id)
        .single();
      updatedBooking = bookingData;
    }
    
    return NextResponse.json({ 
      payment: updatedPayment,
      booking: updatedBooking
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "Failed to verify payment", details: error.message },
      { status: 500 }
    );
  }
}
