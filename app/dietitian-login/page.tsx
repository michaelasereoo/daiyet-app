"use client";

import { useSearchParams } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";

export default function DietitianLoginPage() {
  const searchParams = useSearchParams();
  
  // Get redirect path from query params (callbackUrl from middleware or redirect param)
  const callbackUrl = searchParams.get("callbackUrl");
  const redirectParam = searchParams.get("redirect");
  const redirectPath = callbackUrl || redirectParam || "/dashboard";

  // Show OAuth button immediately - no authentication check on page load
  // Enrollment check happens in auth callback after OAuth completes
  return (
    <AuthScreen
      title="Dietitian login"
      subtitle="Sign in with Google to access your dietitian dashboard."
      redirectPath={redirectPath}
      source="dietitian-login"
    />
  );
}
