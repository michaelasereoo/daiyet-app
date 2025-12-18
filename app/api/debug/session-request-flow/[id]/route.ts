import { NextRequest, NextResponse } from "next/server";
import { createAdminClientServer } from "@/lib/supabase/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * Debug endpoint to trace session request approval flow
 * GET /api/debug/session-request-flow/[id]
 * 
 * This endpoint analyzes the complete flow:
 * 1. Session request approval status
 * 2. Payment record lookup
 * 3. Booking creation (for CONSULTATION)
 * 4. Meeting link creation (for CONSULTATION)
 * 5. Meal plan creation (for MEAL_PLAN)
 * 
 * Compares actual state to expected workflow and identifies errors
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js 15+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { id: sessionRequestId } = resolvedParams;

    const user = await requireAuthFromRequest(request);
    const supabaseAdmin = createAdminClientServer();

    // Step 1: Fetch session request with all related data
    const { data: sessionRequest, error: srError } = await supabaseAdmin
      .from("session_requests")
      .select(`
        id,
        request_type,
        status,
        client_email,
        client_name,
        dietitian_id,
        event_type_id,
        meal_plan_type,
        price,
        currency,
        created_at,
        updated_at,
        dietitian:users!session_requests_dietitian_id_fkey (
          id,
          name,
          email
        ),
        event_type:event_types (
          id,
          title,
          slug,
          price,
          currency
        )
      `)
      .eq("id", sessionRequestId)
      .single();

    if (srError || !sessionRequest) {
      return NextResponse.json(
        {
          error: "Session request not found",
          details: srError?.message || "No session request found with this ID",
        },
        { status: 404 }
      );
    }

    // Verify user has access to this session request
    const userEmail = user.email.toLowerCase().trim();
    if (sessionRequest.client_email.toLowerCase().trim() !== userEmail) {
      return NextResponse.json(
        {
          error: "Forbidden",
          details: "You don't have access to this session request",
        },
        { status: 403 }
      );
    }

    const requestType = sessionRequest.request_type as "CONSULTATION" | "MEAL_PLAN" | "RESCHEDULE_REQUEST";
    const isConsultation = requestType === "CONSULTATION";
    const isMealPlan = requestType === "MEAL_PLAN";

    // Step 2: Find payment records
    // Try to find payments by checking metadata.requestId in payments table
    // Also check by booking_id if booking exists
    let paymentRecord = null;
    let paymentError = null;

    try {
      // Strategy 1: If we have a booking, find payment by booking_id
      // (This will be checked after booking lookup)
      
      // Strategy 2: Search through recent payments and check metadata
      // Note: metadata column may or may not exist - handle gracefully
      const { data: allPayments, error: paymentsError } = await supabaseAdmin
        .from("payments")
        .select(`
          id,
          amount,
          currency,
          status,
          paystack_ref,
          booking_id,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false })
        .limit(200); // Get recent payments to search through

      if (!paymentsError && allPayments) {
        // Filter payments that were created around the same time as session request
        // or after session request was created (within reasonable timeframe)
        const sessionRequestCreatedAt = new Date(sessionRequest.created_at);
        const timeWindowMs = 24 * 60 * 60 * 1000; // 24 hours window
        
        const candidatePayments = allPayments.filter((payment: any) => {
          const paymentCreatedAt = new Date(payment.created_at);
          const timeDiff = paymentCreatedAt.getTime() - sessionRequestCreatedAt.getTime();
          // Payment created within 24 hours after session request
          return timeDiff >= 0 && timeDiff <= timeWindowMs;
        });

        // If we have amount/price info, try to match by amount
        if (sessionRequest.price && candidatePayments.length > 0) {
          const matchingAmount = candidatePayments.find(
            (p: any) => Math.abs(Number(p.amount) - Number(sessionRequest.price)) < 0.01
          );
          if (matchingAmount) {
            paymentRecord = matchingAmount;
          }
        }

        // If still no match, try to check metadata if column exists
        if (!paymentRecord && candidatePayments.length > 0) {
          // Try to select with metadata (may fail if column doesn't exist)
          for (const candidate of candidatePayments.slice(0, 10)) {
            try {
              const { data: paymentWithMetadata } = await supabaseAdmin
                .from("payments")
                .select("*, metadata")
                .eq("id", candidate.id)
                .single();

              if (paymentWithMetadata?.metadata) {
                try {
                  const metadata = typeof paymentWithMetadata.metadata === 'string' 
                    ? JSON.parse(paymentWithMetadata.metadata) 
                    : paymentWithMetadata.metadata;
                  
                  if (metadata.requestId === sessionRequestId || 
                      metadata.request_id === sessionRequestId) {
                    paymentRecord = paymentWithMetadata;
                    break;
                  }
                } catch (parseError) {
                  // Skip invalid metadata
                  continue;
                }
              }
            } catch (metaError) {
              // Metadata column may not exist, skip
              continue;
            }
          }
        }

        // Don't auto-select a payment if we can't confidently match it
        // Better to report "missing" than to match the wrong payment
      } else if (paymentsError) {
        paymentError = paymentsError.message;
      }
    } catch (err: any) {
      paymentError = err.message;
    }

    // Step 3: Check for booking (CONSULTATION only)
    let booking = null;
    let bookingError = null;

    if (isConsultation) {
      try {
        // Find booking that matches this session request
        // Match by: event_type_id, dietitian_id, and user_id (via client_email)
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", sessionRequest.client_email.toLowerCase().trim())
          .single();

        if (userData && sessionRequest.event_type_id && sessionRequest.dietitian_id) {
          const { data: bookingData, error: bookingQueryError } = await supabaseAdmin
            .from("bookings")
            .select(`
              id,
              title,
              status,
              start_time,
              end_time,
              meeting_link,
              event_type_id,
              dietitian_id,
              user_id,
              created_at
            `)
            .eq("event_type_id", sessionRequest.event_type_id)
            .eq("dietitian_id", sessionRequest.dietitian_id)
            .eq("user_id", userData.id)
            .order("created_at", { ascending: false })
            .limit(10);

          if (!bookingQueryError && bookingData && bookingData.length > 0) {
            // Find the most recent booking that was created after the session request
            const sessionRequestCreatedAt = new Date(sessionRequest.created_at);
            const matchingBookings = bookingData.filter(
              (b: any) => new Date(b.created_at) >= sessionRequestCreatedAt
            );
            
            if (matchingBookings.length > 0) {
              booking = matchingBookings[0];
            } else {
              // If no booking created after session request, use the most recent one
              booking = bookingData[0];
            }

            // If we found a booking and don't have payment yet, try to find payment by booking_id
            if (booking && !paymentRecord) {
              try {
                const { data: paymentByBooking } = await supabaseAdmin
                  .from("payments")
                  .select(`
                    id,
                    amount,
                    currency,
                    status,
                    paystack_ref,
                    booking_id,
                    created_at,
                    updated_at
                  `)
                  .eq("booking_id", booking.id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (paymentByBooking) {
                  paymentRecord = paymentByBooking;
                }
              } catch (paymentLookupError) {
                // Continue without payment if lookup fails
              }
            }
          } else {
            bookingError = bookingQueryError?.message || "No booking found matching this session request";
          }
        } else {
          bookingError = "Could not find user or missing event_type_id/dietitian_id";
        }
      } catch (err: any) {
        bookingError = err.message;
      }
    }

    // Step 4: Check for meeting link (CONSULTATION only)
    let meetingLinkStatus = null;
    let meetingLinkError = null;

    if (isConsultation && booking) {
      try {
        if (booking.meeting_link) {
          meetingLinkStatus = {
            exists: true,
            link: booking.meeting_link,
            bookingStatus: booking.status,
          };
        } else {
          meetingLinkStatus = {
            exists: false,
            bookingStatus: booking.status,
            message: "Booking exists but meeting_link is null",
          };
        }
      } catch (err: any) {
        meetingLinkError = err.message;
      }
    }

    // Step 5: Check for meal plan (MEAL_PLAN only)
    let mealPlan = null;
    let mealPlanError = null;

    if (isMealPlan) {
      try {
        const { data: mealPlanData, error: mealPlanQueryError } = await supabaseAdmin
          .from("meal_plans")
          .select(`
            id,
            session_request_id,
            dietitian_id,
            user_id,
            package_name,
            file_url,
            file_name,
            status,
            sent_at,
            created_at
          `)
          .eq("session_request_id", sessionRequestId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mealPlanQueryError) {
          mealPlan = mealPlanData;
          if (!mealPlan) {
            mealPlanError = "No meal plan found for this session request";
          }
        } else {
          mealPlanError = mealPlanQueryError.message;
        }
      } catch (err: any) {
        mealPlanError = err.message;
      }
    }

    // Build flow analysis
    const flow = {
      step1_approval: {
        status: sessionRequest.status === "APPROVED" ? "complete" : 
                sessionRequest.status === "PENDING" ? "pending" : "error",
        details: {
          currentStatus: sessionRequest.status,
          expectedStatus: "APPROVED",
          isApproved: sessionRequest.status === "APPROVED",
        },
      },
      step2_payment: {
        status: paymentRecord ? (paymentRecord.status === "SUCCESS" || paymentRecord.status === "success" ? "complete" : "pending") : "missing",
        paymentRecord: paymentRecord ? {
          id: paymentRecord.id,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          paystack_ref: paymentRecord.paystack_ref,
          booking_id: paymentRecord.booking_id,
          created_at: paymentRecord.created_at,
        } : null,
        error: paymentError || (paymentRecord ? null : "No payment record found"),
      },
      step3_booking: isConsultation ? {
        status: booking ? (booking.status === "CONFIRMED" ? "complete" : "pending") : "missing",
        booking: booking ? {
          id: booking.id,
          title: booking.title,
          status: booking.status,
          start_time: booking.start_time,
          end_time: booking.end_time,
          meeting_link: booking.meeting_link,
          created_at: booking.created_at,
        } : null,
        error: bookingError || (booking ? null : "No booking found for CONSULTATION request"),
      } : null,
      step4_meetingLink: isConsultation ? {
        status: meetingLinkStatus?.exists ? "complete" : 
                booking ? "missing" : "skipped",
        meetingLink: meetingLinkStatus?.link || null,
        bookingStatus: meetingLinkStatus?.bookingStatus || booking?.status || null,
        error: meetingLinkError || (meetingLinkStatus?.exists ? null : meetingLinkStatus?.message || "Meeting link not found"),
      } : null,
      step4_mealPlan: isMealPlan ? {
        status: mealPlan ? (mealPlan.file_url ? "complete" : "incomplete") : "missing",
        mealPlan: mealPlan ? {
          id: mealPlan.id,
          package_name: mealPlan.package_name,
          file_url: mealPlan.file_url,
          file_name: mealPlan.file_name,
          status: mealPlan.status,
          sent_at: mealPlan.sent_at,
        } : null,
        error: mealPlanError || (mealPlan ? null : "No meal plan found for MEAL_PLAN request"),
      } : null,
    };

    // Identify errors and missing steps
    const errors: Array<{ step: string; message: string; fix: string }> = [];
    const recommendations: string[] = [];

    // Check approval step
    if (flow.step1_approval.status !== "complete") {
      errors.push({
        step: "approval",
        message: `Session request is ${sessionRequest.status}, expected APPROVED`,
        fix: isConsultation 
          ? "Complete payment to approve the session request"
          : "Wait for dietitian to approve or process payment",
      });
    }

    // Check payment step
    if (flow.step2_payment.status === "missing") {
      // Only add error if session request is approved (meaning payment should exist)
      if (sessionRequest.status === "APPROVED") {
        errors.push({
          step: "payment",
          message: "No payment record found for approved session request",
          fix: "Payment record may be missing. Check Paystack transaction history and verify payment was recorded in database.",
        });
      } else {
        recommendations.push("Payment record not found. This is expected if payment hasn't been processed yet.");
      }
    } else if (flow.step2_payment.status === "pending") {
      recommendations.push("Payment record exists but status is not SUCCESS. Verify payment with Paystack.");
    }

    // Check booking step (CONSULTATION)
    if (isConsultation) {
      if (flow.step3_booking?.status === "missing") {
        errors.push({
          step: "booking_creation",
          message: "No booking found for CONSULTATION request. This is the critical missing step.",
          fix: "Booking should be created when session request is approved with payment. Check if booking creation logic is executed in /api/user/approve-request/[id] endpoint.",
        });
      } else if (flow.step3_booking?.status === "pending") {
        recommendations.push("Booking exists but status is not CONFIRMED. Verify booking confirmation logic.");
      }

      // Check meeting link step
      if (flow.step4_meetingLink?.status === "missing") {
        errors.push({
          step: "meeting_link_creation",
          message: "Meeting link is missing for booking",
          fix: "Meeting link should be created after booking confirmation. Check /api/payments/verify or booking confirmation logic.",
        });
      }

      // Check payment-booking link
      if (paymentRecord && booking && paymentRecord.booking_id !== booking.id) {
        errors.push({
          step: "payment_booking_link",
          message: `Payment (booking_id: ${paymentRecord.booking_id}) does not match found booking (id: ${booking.id})`,
          fix: "Payment should be linked to the booking via booking_id. Verify payment creation logic.",
        });
      } else if (paymentRecord && !paymentRecord.booking_id && booking) {
        errors.push({
          step: "payment_booking_link",
          message: "Payment exists but is not linked to booking (booking_id is null)",
          fix: "Update payment record to link it to the booking: UPDATE payments SET booking_id = ? WHERE id = ?",
        });
      }
    }

    // Check meal plan step (MEAL_PLAN)
    if (isMealPlan) {
      if (flow.step4_mealPlan?.status === "missing") {
        errors.push({
          step: "meal_plan_creation",
          message: "No meal plan found for MEAL_PLAN request",
          fix: "Meal plan should be created by dietitian after session request is approved. Check if dietitian has sent the meal plan PDF.",
        });
      } else if (flow.step4_mealPlan?.status === "incomplete") {
        errors.push({
          step: "meal_plan_file",
          message: "Meal plan exists but file_url is missing",
          fix: "Meal plan record exists but PDF file is missing. Dietitian should re-upload the meal plan PDF.",
        });
      }
    }

    // Build comparison to meal plan workflow
    const comparison = {
      mealPlanWorkflow: {
        expectedSteps: [
          "1. Session request created (PENDING)",
          "2. User pays → session request approved",
          "3. Dietitian sends meal plan PDF → meal_plans record created",
          "4. Meal plan linked to session request via session_request_id",
        ],
        notes: "Meal plan workflow does NOT require booking creation",
      },
      consultationWorkflow: {
        expectedSteps: [
          "1. Session request created (PENDING)",
          "2. User pays → session request approved",
          "3. Booking created with event_type_id, dietitian_id, user_id",
          "4. Payment linked to booking via booking_id",
          "5. Booking confirmed (status: CONFIRMED)",
          "6. Meeting link created and added to booking",
        ],
        notes: "Consultation workflow REQUIRES booking creation and meeting link",
      },
    };

    // Build summary
    const summary = {
      requestType,
      isComplete: errors.length === 0,
      totalErrors: errors.length,
      totalRecommendations: recommendations.length,
      criticalIssues: errors.filter(e => 
        e.step.includes("booking") || e.step.includes("meeting_link")
      ).length,
    };

    return NextResponse.json({
      sessionRequest: {
        id: sessionRequest.id,
        requestType: sessionRequest.request_type,
        status: sessionRequest.status,
        clientEmail: sessionRequest.client_email,
        clientName: sessionRequest.client_name,
        dietitian: sessionRequest.dietitian,
        eventType: sessionRequest.event_type,
        mealPlanType: sessionRequest.meal_plan_type,
        price: sessionRequest.price,
        currency: sessionRequest.currency,
        createdAt: sessionRequest.created_at,
        updatedAt: sessionRequest.updated_at,
      },
      flow,
      comparison,
      errors,
      recommendations,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Debug session request flow error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze session request flow",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

