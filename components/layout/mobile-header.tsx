"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface MobileHeaderProps {
  onMenuClick?: () => void;
  title?: string;
}

export function MobileHeader({ onMenuClick, title = "Cal.com" }: MobileHeaderProps) {
  const { profile } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#171717] border-b border-[#374151] lg:hidden">
      {/* Status bar spacer */}
      <div className="h-safe-top" />
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo only */}
          <Link href="/" className="flex items-center">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </Link>

        {/* Right: Settings, Profile */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings"
            className="p-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link
            href="/dashboard/settings/profile"
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
                  {profile ? getInitials(profile.name) : "D"}
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#171717] border-b border-[#374151] lg:hidden">
      {/* Status bar spacer */}
      <div className="h-safe-top" />
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Logo only */}
          <Link href="/" className="flex items-center">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
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
                  {profile ? getInitials(profile.name) : "U"}
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

