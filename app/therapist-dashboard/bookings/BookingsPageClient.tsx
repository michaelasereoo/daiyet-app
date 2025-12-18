"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { BookingsList } from "@/components/bookings/BookingsList";
import { Button } from "@/components/ui/button";
import {
  Filter,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  eventTypeSlug?: string | null;
}

interface BookingsPageClientProps {
  bookings: Booking[];
  type: "upcoming" | "unconfirmed" | "recurring" | "past" | "canceled";
}

export default function BookingsPageClient({
  bookings: initialBookings,
  type,
}: BookingsPageClientProps) {
  const [bookings] = useState(initialBookings);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const totalBookings = bookings.length;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedBookings = bookings.slice(startIndex, endIndex);
  const totalPages = Math.ceil(totalBookings / rowsPerPage);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Mobile Header - Only on mobile */}
      <div className="lg:hidden">
        <MobileHeader />
      </div>
      
      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <DashboardSidebar />
      
      {/* Main Content */}
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg pb-16 lg:pb-0">
        <div className="p-6 lg:p-8 pt-14 lg:pt-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Bookings
            </h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              See upcoming and past events booked through your event type links.
            </p>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
              <Button
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 w-full sm:w-auto"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  variant="outline"
                  className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                >
                  Saved filters
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bookings List */}
          <BookingsList bookings={paginatedBookings} type={type} />

          {/* Pagination - Only show if there are bookings */}
          {totalBookings > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-6 pt-6 border-t border-[#262626]">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-[#9ca3af]">Rows per page:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#171717] border border-[#262626] text-[#f9fafb] text-xs sm:text-sm rounded px-2 py-1.5 focus:outline-none focus:ring-0 min-h-[44px]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                <span className="text-xs sm:text-sm text-[#9ca3af]">
                  <span className="hidden sm:inline">{startIndex + 1}-{Math.min(endIndex, totalBookings)} of </span>
                  {totalBookings}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1}
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
}