"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Menu } from "lucide-react";

interface SettingsMobileHeaderProps {
  title?: string;
  onMenuClick: () => void;
  backHref?: string;
}

export function SettingsMobileHeader({ 
  title = "Settings", 
  onMenuClick,
  backHref 
}: SettingsMobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#171717] border-b border-[#374151] lg:hidden">
      {/* Status bar spacer */}
      <div className="h-safe-top" />
      
      {/* Main header */}
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Back button and Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onMenuClick}
            className="p-2 -ml-2 text-[#D4D4D4] hover:text-[#f9fafb] hover:bg-[#374151] rounded-md transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Center/Right: Title */}
        <div className="flex-1 text-center">
          <h1 className="text-base font-semibold text-[#f9fafb]">{title}</h1>
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-20" />
      </div>
    </header>
  );
}
