"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SettingsMobileHeader } from "@/components/layout/settings-mobile-header";
import { ArrowLeft, User, Settings as SettingsIcon, Calendar, Clock, Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNavigation = [
  { name: "Profile", href: "/therapist-dashboard/settings/profile", icon: User },
  { name: "General", href: "/therapist-dashboard/settings/general", icon: SettingsIcon },
  { name: "Calendars", href: "/therapist-dashboard/settings/calendars", icon: Calendar },
  { name: "Out of office", href: "/therapist-dashboard/settings/out-of-office", icon: Clock },
  { name: "Notifications", href: "/therapist-dashboard/settings/notifications", icon: Bell },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when pathname changes on mobile
  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <DashboardSidebar />
      
      {/* Mobile Header */}
      <div className="lg:hidden">
        <SettingsMobileHeader 
          title="Settings"
          onMenuClick={() => setSidebarOpen(true)}
          backHref="/therapist-dashboard"
        />
      </div>

      {/* Settings Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col lg:flex-row w-full lg:w-auto lg:ml-64">
        {/* Settings Sidebar */}
        <aside className={cn(
          "w-64 bg-[#0f0f0f] border-r border-[#262626] flex-col h-screen fixed lg:relative z-50",
          "transform transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "lg:flex"
        )}>
          {/* Mobile Close Button */}
          {sidebarOpen && (
            <div className="lg:hidden p-4 border-b border-[#262626] flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/daiyet logo.svg"
                  alt="Daiyet"
                  width={120}
                  height={32}
                  className="h-6 w-auto"
                />
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-[#D4D4D4] hover:text-[#f9fafb] p-2 -mr-2"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Back Button - Desktop only */}
          <div className="hidden lg:block p-4 border-b border-[#262626]">
            <button
              onClick={() => router.push("/therapist-dashboard")}
              className="flex items-center gap-2 text-sm text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          {/* Settings Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {settingsNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2.5 rounded-md text-[15px] font-medium transition-colors",
                    isActive
                      ? "bg-[#404040] text-[#f9fafb]"
                      : "text-[#D4D4D4] hover:bg-[#374151] hover:text-[#f9fafb]"
                  )}
                >
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full">
          <div className="p-6 lg:p-8 pt-6 lg:pt-8">
          {children}
          </div>
        </main>
      </div>
    </div>
  );
}
