"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Settings, Menu } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

interface MobileHeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function MobileHeader({ onMenuClick, title = "Cal.com" }: MobileHeaderProps) {
  const { profile } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

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
        {/* Left: Logo/Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={90}
              height={24}
              className="h-6 w-auto"
            />
          </Link>
        </div>

        {/* Right: Search, Settings, Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchFocused(true)}
            className="p-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
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

      {/* Search bar - shown when focused */}
      {searchFocused && (
        <div className="px-4 pb-3 border-b border-[#374151]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              className="w-full bg-[#262626] border border-[#374151] rounded-md pl-10 pr-4 py-2 text-sm text-[#f9fafb] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-transparent"
              onBlur={() => setSearchFocused(false)}
            />
            <button
              onClick={() => setSearchFocused(false)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] hover:text-[#f9fafb] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// User dashboard mobile header
export function UserMobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);

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
        {/* Left: Logo/Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={90}
              height={24}
              className="h-6 w-auto"
            />
          </Link>
        </div>

        {/* Right: Search, Settings, Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchFocused(true)}
            className="p-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
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

      {/* Search bar - shown when focused */}
      {searchFocused && (
        <div className="px-4 pb-3 border-b border-[#374151]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              className="w-full bg-[#262626] border border-[#374151] rounded-md pl-10 pr-4 py-2 text-sm text-[#f9fafb] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:border-transparent"
              onBlur={() => setSearchFocused(false)}
            />
            <button
              onClick={() => setSearchFocused(false)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] hover:text-[#f9fafb] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

