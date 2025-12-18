"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";

function SignupContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  
  // Determine source for tracking - if source=therapy, pass it through
  const authSource = source === "therapy" ? "therapy-signup" : undefined;

  return (
    <AuthScreen
      title="Get started for free"
      subtitle="Join Daiyet with your Google account to book and manage consultations."
      redirectPath="/user-dashboard"
      source={authSource}
    />
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
