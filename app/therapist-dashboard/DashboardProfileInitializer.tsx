"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import type { UserProfile } from "@/components/providers/AuthProvider";

interface DashboardProfileInitializerProps {
  initialProfile: { name: string | null; image: string | null } | null;
  children: React.ReactNode;
}

/**
 * Client component that initializes profile in AuthProvider context
 * from server-side fetched data. This prevents prop drilling and ensures
 * the profile is available throughout the dashboard via context.
 * 
 * Uses setProfileDirect (not updateProfile) to avoid unnecessary DB writes.
 */
export function DashboardProfileInitializer({
  initialProfile,
  children,
}: DashboardProfileInitializerProps) {
  const { setProfileDirect, profile } = useAuth();

  useEffect(() => {
    // Only update if we have initialProfile and it's different from current profile
    if (initialProfile) {
      const profileChanged = !profile || 
        profile.name !== initialProfile.name || 
        profile.image !== initialProfile.image;
      
      if (profileChanged) {
        console.log("DashboardProfileInitializer: Initializing profile from server data", initialProfile);
        setProfileDirect(initialProfile);
      }
    }
  }, [initialProfile, profile, setProfileDirect]);

  return <>{children}</>;
}

