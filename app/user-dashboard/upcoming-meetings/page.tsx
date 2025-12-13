"use client";

import { useEffect, useState } from "react";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { UserMobileHeader } from "@/components/layout/mobile-header";
import { UserBottomNavigation } from "@/components/layout/bottom-navigation";
import { BookingsList } from "@/components/bookings/BookingsList";
import { useBookingsStream } from "@/hooks/useBookingsStream";
import dayjs from "dayjs";

export default function UpcomingMeetingsPage() {
  const { bookings, isConnected, error } = useBookingsStream();
  const [initialBookingsLoaded, setInitialBookingsLoaded] = useState(false);

  // Preload bookings data immediately
  useEffect(() => {
    const fetchInitialBookings = async () => {
      try {
        const response = await fetch("/api/bookings", {
          credentials: "include",
        });
        if (response.ok) {
          setInitialBookingsLoaded(true);
        }
      } catch (err) {
        console.error("Error preloading bookings:", err);
      }
    };
    fetchInitialBookings();
  }, []);

  // Filter to only upcoming confirmed bookings
  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.startTime) >= now
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Mobile Header - Only on mobile */}
      <div className="lg:hidden">
        <UserMobileHeader />
      </div>
      
      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <UserDashboardSidebar />
      
      {/* Main Content */}
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg pb-16 lg:pb-0">
        <div className="p-6 lg:p-8 pt-14 lg:pt-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-xl lg:text-[15px] font-semibold text-[#f9fafb] mb-1">Upcoming Meetings</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              View and manage your upcoming meetings with dieticians.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-200">{error}</p>
            </div>
          )}

          {/* Bookings List */}
          {upcomingBookings.length > 0 ? (
            <BookingsList bookings={upcomingBookings} type="upcoming" />
          ) : (
            <div className="text-center py-12 border border-[#262626] rounded-lg">
              <p className="text-sm text-[#9ca3af]">No upcoming meetings scheduled.</p>
            </div>
          )}
        </div>
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <div className="lg:hidden">
        <UserBottomNavigation />
      </div>
    </div>
  );
}
