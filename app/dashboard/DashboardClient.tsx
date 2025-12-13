"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { BookingsList } from "@/components/bookings/BookingsList";

export interface DashboardStats {
  totalSessions: number;
  upcomingSessions: number;
  totalRevenue: number;
}

export interface Booking {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  title: string;
  description: string;
  message?: string;
  participants: string[];
  meetingLink?: string;
}

interface DashboardClientProps {
  stats: DashboardStats;
  upcomingBookings: Booking[];
  userName?: string;
}

export default function DashboardClient({
  stats,
  upcomingBookings,
  userName,
}: DashboardClientProps) {
  const displayName = userName || "Dietitian";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Mobile Header */}
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Sidebar - Hidden on mobile, opens from menu */}
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      {/* Main Content */}
      <main className="flex-1 bg-[#101010] overflow-y-auto lg:ml-64 rounded-tl-lg pb-16 lg:pb-0 w-full">
        <div className="p-4 lg:p-8 pt-14 lg:pt-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Welcome back, {displayName}!
            </h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Overview of your bookings and revenue.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Total Sessions Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Total Sessions</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {stats.totalSessions.toLocaleString()}
              </div>
            </div>

            {/* Upcoming Sessions Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">
                Upcoming Sessions
              </div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {stats.upcomingSessions.toLocaleString()}
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Total Revenue</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                ₦{stats.totalRevenue.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Upcoming Meetings Section */}
          <div className="mb-6">
            <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Upcoming Meetings
            </h2>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              See your upcoming meetings and bookings.
            </p>
          </div>

          {/* Bookings List */}
          {upcomingBookings.length > 0 ? (
            <BookingsList bookings={upcomingBookings} type="upcoming" />
          ) : (
            <div className="text-[#9ca3af] text-sm">No upcoming bookings</div>
          )}
        </div>
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation />
    </div>
  );
}