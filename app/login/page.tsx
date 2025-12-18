"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";

function LoginContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  
  // Determine source for tracking - if source=therapy, pass it through
  const authSource = source === "therapy" ? "therapy-login" : undefined;

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in with Google to access your Daiyet workspace."
      redirectPath="/user-dashboard"
      source={authSource}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
