"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorType = searchParams.get("type");
  const errorCode = searchParams.get("code");
  const errorDesc = searchParams.get("desc");
  const error = searchParams.get("error");

  const getErrorDetails = () => {
    switch (errorType) {
      case "rate_limit":
        return {
          title: "Too Many Requests",
          message: "You've made too many authentication attempts. Please wait a moment and try again.",
          suggestion: "Wait 1 minute before trying again.",
        };
      case "callback_error":
        return {
          title: "Authentication Error",
          message: "An error occurred during authentication. Please try again.",
          suggestion: "Try signing in again, or contact support if the problem persists.",
        };
      case "code_exchange":
        return {
          title: "Session Error",
          message: error || "Failed to establish your session. Please try again.",
          suggestion: "Try signing in again.",
        };
      case "no_session":
        return {
          title: "Session Not Found",
          message: "Your session could not be established. Please try signing in again.",
          suggestion: "Try signing in again.",
        };
      case "no_auth_data":
        return {
          title: "Authentication Data Missing",
          message: "Required authentication data was not found. Please try signing in again.",
          suggestion: "Try signing in again.",
        };
      case "handler_error":
        return {
          title: "Authentication Handler Error",
          message: error || "An error occurred while processing your authentication.",
          suggestion: "Try signing in again, or contact support if the problem persists.",
        };
      default:
        if (errorCode) {
          return {
            title: "OAuth Error",
            message: errorDesc || errorCode || "An error occurred during OAuth authentication.",
            suggestion: "Try signing in again, or contact support if the problem persists.",
          };
        }
        return {
          title: "Authentication Error",
          message: error || "An unexpected error occurred during authentication.",
          suggestion: "Try signing in again, or contact support if the problem persists.",
        };
    }
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="relative min-h-screen bg-[#0b0b0b] text-white overflow-hidden flex items-center justify-center px-4 sm:px-6 md:px-8 py-10 md:py-14">
      {/* Faint grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "140px 140px",
          maskImage:
            "radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 75%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      <div className="relative z-10 w-full max-w-2xl text-center space-y-8">
        <div className="bg-white/5 border border-red-500/20 rounded-2xl md:rounded-3xl px-6 sm:px-10 md:px-12 py-10 md:py-12 backdrop-blur-sm shadow-2xl shadow-black/40">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            {errorDetails.title}
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl mx-auto mb-6">
            {errorDetails.message}
          </p>

          <p className="text-xs sm:text-sm text-white/50 mb-8">{errorDetails.suggestion}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Go Back
            </Button>
            <Link href="/dietitian-login">
              <Button className="bg-white text-black hover:bg-white/90">
                Try Signing In Again
              </Button>
            </Link>
          </div>
        </div>

        <div className="text-[11px] sm:text-xs text-white/50">
          If this problem persists, please contact support.
        </div>
      </div>
    </div>
  );
}
