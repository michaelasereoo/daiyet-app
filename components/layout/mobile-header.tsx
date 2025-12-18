"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

interface MobileHeaderProps {
  onMenuClick?: () => void;
  title?: string;
}

export function MobileHeader({ onMenuClick, title = "Cal.com" }: MobileHeaderProps) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const isTherapistDashboard = pathname?.startsWith("/therapist-dashboard");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const settingsHref = isTherapistDashboard ? "/therapist-dashboard/settings" : "/dashboard/settings";
  const profileHref = isTherapistDashboard ? "/therapist-dashboard/settings/profile" : "/dashboard/settings/profile";
  const fallbackInitial = isTherapistDashboard ? "T" : "D";

  return (
    <header className="sticky top-0 z-40 bg-[#171717] border-b border-[#374151] lg:hidden">
      {/* Status bar spacer */}
      <div className="h-safe-top" />
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo only */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            {isTherapistDashboard && (
              <span className="text-xs font-medium text-white/60">Therapy</span>
            )}
          </Link>

        {/* Right: Settings, Profile */}
        <div className="flex items-center gap-2">
          <Link
            href={settingsHref}
            className="p-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link
            href={profileHref}
            className="relative"
            aria-label="Profile"
          >
            {profile?.image ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#374151]">
                <Image
                  src={profile.image}
                  alt={profile.name || "Profile"}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center border-2 border-[#374151]">
                <span className="text-white text-xs font-semibold">
                  {profile?.name ? getInitials(profile.name) : fallbackInitial}
                </span>
              </div>
            )}
            {/* Online status indicator */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#171717]"
              style={{ backgroundColor: "#E5FF53" }}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

// User dashboard mobile header
export function UserMobileHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { profile } = useAuth();
  const [signupSource, setSignupSource] = useState<string | null>(null);

  useEffect(() => {
    // Fetch signup_source to determine if user came from dietitian or therapy route
    const fetchSignupSource = async () => {
      try {
        const response = await fetch("/api/user/profile", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.signup_source) {
            setSignupSource(data.profile.signup_source);
          }
        }
      } catch (err) {
        console.error("Error fetching signup source:", err);
      }
    };
    fetchSignupSource();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Show "Therapy" only if signup_source is "therapy", otherwise show "Diet"
  const logoText = signupSource === "therapy" ? "Therapy" : "Diet";

  return (
    <header className="sticky top-0 z-40 bg-[#171717] border-b border-[#374151] lg:hidden">
      {/* Status bar spacer */}
      <div className="h-safe-top" />
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo only */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-xs font-medium text-white/60">{logoText}</span>
          </Link>

        {/* Right: Settings, Profile */}
        <div className="flex items-center gap-2">
          <Link
            href="/user-dashboard/settings"
            className="p-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link
            href="/user-dashboard/profile-settings"
            className="relative"
            aria-label="Profile"
          >
            {profile?.image ? (
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[#374151]">
                <Image
                  src={profile.image}
                  alt={profile.name || "Profile"}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#404040] to-[#525252] flex items-center justify-center border-2 border-[#374151]">
                <span className="text-white text-xs font-semibold">
                  {profile?.name ? getInitials(profile.name) : "U"}
                </span>
              </div>
            )}
            {/* Online status indicator */}
            <div
              className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#171717]"
              style={{ backgroundColor: "#E5FF53" }}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

