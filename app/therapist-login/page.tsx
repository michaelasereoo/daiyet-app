"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";

function TherapistLoginContent() {
  const searchParams = useSearchParams();
  
  // Get redirect path from query params (callbackUrl from middleware or redirect param)
  const callbackUrl = searchParams.get("callbackUrl");
  const redirectParam = searchParams.get("redirect");
  const redirectPath = callbackUrl || redirectParam || "/therapist-dashboard";

  // Show OAuth button immediately - no authentication check on page load
  // Enrollment check happens in auth callback after OAuth completes
  return (
    <AuthScreen
      title="Therapist login"
      subtitle="Sign in with Google to access your therapist dashboard."
      redirectPath={redirectPath}
      source="therapist-login"
    />
  );
}

export default function TherapistLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0b0b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    }>
      <TherapistLoginContent />
    </Suspense>
  );
}
