"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createComponentClient } from "@/lib/supabase/client";
import { authConfig } from "@/lib/auth/config";

interface AuthScreenProps {
  title: string;
  subtitle: string;
  redirectPath?: string;
  source?: string; // Track where OAuth was initiated (e.g., "dietitian-login")
}

export function AuthScreen({ title, subtitle, redirectPath = "/user-dashboard", source }: AuthScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createComponentClient();

      // FIXED: Let Supabase handle state - don't use custom state
      // Add source parameter to track where OAuth was initiated
      const callbackUrl = source 
        ? `${window.location.origin}/auth/callback?source=${encodeURIComponent(source)}`
        : `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: authConfig.providers.google.additionalParams.access_type,
            prompt: authConfig.providers.google.additionalParams.prompt,
          },
          scopes: authConfig.providers.google.scopes.join(" "),
        },
      });

      if (error) {
        console.error("OAuth initiation error:", error);
        setError(error.message);
        setIsLoading(false);
      }
      // OAuth will redirect automatically - don't handle success here
    } catch (err) {
      console.error("OAuth error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
      setIsLoading(false);
    }
  };

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

      <div className="relative z-10 w-full max-w-4xl text-center space-y-8 md:space-y-10 py-10 md:py-12">
        <div className="flex items-center justify-between text-xs sm:text-sm text-white/70 mb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <span className="text-lg leading-none">←</span> Back
          </Link>
          <span className="hidden sm:block" />
        </div>

        <div className="flex items-center justify-center gap-3 text-sm text-white/70">
          <Image
            src="/daiyet logo.svg"
            alt="Daiyet"
            width={120}
            height={32}
            className="h-7 w-auto"
          />
          <span className="text-white/50">Secure access with Google</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl px-6 sm:px-10 md:px-12 py-10 md:py-12 backdrop-blur-sm shadow-2xl shadow-black/40">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight mb-3 sm:mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10">
            {subtitle}
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={handleGoogle}
              disabled={isLoading}
              className="h-14 sm:h-12 w-full sm:w-auto min-w-[200px] px-6 bg-white text-black hover:bg-white/90 border border-white/30 transition-colors inline-flex items-center justify-center gap-2 text-base sm:text-sm font-medium"
            >
              <GoogleIcon />
              {isLoading ? "Connecting..." : "Continue with Google"}
            </Button>
            {error && <p className="text-sm text-red-300 max-w-md">{error}</p>}
          </div>
        </div>

        <div className="text-[11px] sm:text-xs text-white/50">
          Secure authentication powered by Google OAuth.
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
        <path
          fill="#EA4335"
          d="M24 9.5c3.15 0 5.81 1.08 7.96 2.85l5.95-5.95C33.63 2.3 29.18 0.5 24 0.5 14.7 0.5 6.61 5.97 2.87 13.55l7.12 5.52C12.2 13.9 17.64 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.5 24.5c0-1.57-.14-3.07-.39-4.5H24v9h12.65c-.55 2.86-2.2 5.3-4.7 6.93l7.36 5.72C43.77 37.9 46.5 31.7 46.5 24.5z"
        />
        <path
          fill="#FBBC05"
          d="M10.23 28.93A14.46 14.46 0 0 1 9.5 24c0-1.7.29-3.34.79-4.87l-7.12-5.52A23.95 23.95 0 0 0 .5 24c0 3.9.93 7.58 2.57 10.87l7.16-5.94z"
        />
        <path
          fill="#34A853"
          d="M24 47.5c6.5 0 11.94-2.15 15.92-5.85l-7.36-5.72C30.52 37.53 27.42 38.5 24 38.5c-6.36 0-11.8-4.4-13.95-10.5l-7.12 5.52C6.61 42.03 14.7 47.5 24 47.5z"
        />
        <path fill="none" d="M0 0h48v48H0z" />
      </svg>
    </span>
  );
}
