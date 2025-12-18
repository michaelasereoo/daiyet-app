"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, CreditCard, Loader2 } from "lucide-react";
import { getEmailFromSession, isValidEmail } from "@/lib/email-utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentData: any) => void;
  amount: number;
  currency: string;
  description: string;
  requestType: "CONSULTATION" | "MEAL_PLAN";
  requestId?: string;
  bookingId?: string;
  userEmail?: string;
  userName?: string;
}

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        onClose: () => void;
        callback: (response: { reference: string }) => void;
        metadata?: Record<string, any>;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  amount,
  currency,
  description,
  requestType,
  requestId,
  bookingId,
  userEmail,
  userName,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalEmail, setFinalEmail] = useState<string | null>(null);
  const [finalName, setFinalName] = useState<string | null>(null);

  // Fetch email and name from session - ALWAYS prioritize session email for reliability
  useEffect(() => {
    const ensureUserData = async () => {
      setIsLoadingUserData(true);
      
      try {
        const { createBrowserClient } = await import("@/lib/supabase/client");
        const supabase = createBrowserClient();
        
        // Add timeout to prevent hanging on auth.getSession in slow or unstable environments
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Session fetch timed out")), 10000)
        );

        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]) as any;

        if (sessionError || !session?.user) {
          // If session fetch fails but we have props, use props
          if (isValidEmail(userEmail)) {
            setFinalEmail(userEmail!);
            setFinalName(userName || "User");
            setError(null);
            setIsLoadingUserData(false);
            return;
          }
          // If we can't get session and have no props, don't block payment here.
          // Server-side Paystack initialize route will still enforce real auth.
          setError(null);
          setIsLoadingUserData(false);
          return;
        }

        const sessionUser = session.user;
        const sessionEmail = sessionUser.email;

        // PRIORITY: session email (most reliable for Google OAuth) > props > error
        // Session email should ALWAYS be available for authenticated Google users
        if (isValidEmail(sessionEmail)) {
          setFinalEmail(sessionEmail!);
        } else if (isValidEmail(userEmail)) {
          // Fallback to props if session email somehow unavailable
          setFinalEmail(userEmail!);
        } else {
          setError("Email is required for payment. Please ensure you are logged in.");
          setIsLoadingUserData(false);
          return;
        }

        // Get name - priority: props > Google auth metadata > session email prefix
        const resolvedName = 
          userName ||
          sessionUser.user_metadata?.name ||
          sessionUser.user_metadata?.full_name ||
          sessionUser.email?.split("@")[0] ||
          "User";
        
        setFinalName(resolvedName);
        setError(null);
      } catch (err) {
        console.error("Error fetching user data from session:", err);
        // Last resort: use props if available
        if (isValidEmail(userEmail)) {
          setFinalEmail(userEmail!);
          setFinalName(userName || "User");
          setError(null);
        } else {
          // Don't surface an auth error here; let the server auth check handle it
          setError(null);
        }
      } finally {
        setIsLoadingUserData(false);
      }
    };

    if (isOpen) {
      ensureUserData();
    }
  }, [isOpen, userEmail, userName]);

  const handlePayment = async () => {
    // Use finalEmail and finalName (which may have been fetched from session)
    let emailToUse = finalEmail || userEmail;
    let nameToUse = finalName || userName;

    // We no longer block payment on client-side email resolution.
    // The server-side Paystack initialize route reads the authenticated user
    // from cookies and will fail with 401 if the user is not actually logged in.

    try {
      setIsProcessing(true);
      setError(null);

      // Initialize payment via our API (avoids CORS issues)
      // Email and name are retrieved from authenticated session on server
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Email and name are retrieved from authenticated session (OAuth) on server
          amount: amount * 100, // Paystack expects amount in kobo
          bookingId: bookingId || requestId || undefined, // Use bookingId if available
          metadata: {
            requestId: requestId || "",
            requestType,
            description,
            bookingId: bookingId || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to initialize payment");
      }

      const data = await response.json();
      
      if (!data.authorization_url) {
        throw new Error("No payment URL received from server");
      }

      // Redirect to Paystack payment page (will redirect back after payment)
      window.location.href = data.authorization_url;
    } catch (err) {
      console.error("Payment initialization error:", err);
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#262626]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#262626] flex-shrink-0">
              <CreditCard className="h-5 w-5 text-[#f9fafb]" />
            </div>
            <h2 className="text-lg font-semibold text-[#f9fafb]">
              Complete Payment
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[#D4D4D4] mb-3">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#9ca3af]">{description}</span>
              </div>
              <div className="border-t border-[#262626] pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[#f9fafb]">Total</span>
                  <span className="text-lg font-semibold text-[#f9fafb]">
                    ₦{amount.toLocaleString()} {currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3">
              <p>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#262626]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              // Do not block payment button based on email/session loading;
              // server-side auth will still guard the Paystack init route.
              disabled={isProcessing}
              className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isLoadingUserData ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Pay ₦{amount.toLocaleString()}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
