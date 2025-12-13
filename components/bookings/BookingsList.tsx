import { BookingCard } from "./BookingCard";
import { Calendar } from "lucide-react";

interface Booking {
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

interface BookingsListProps {
  bookings: Booking[];
  type?: "upcoming" | "unconfirmed" | "recurring" | "past" | "canceled";
}

const emptyStateMessages = {
  upcoming: {
    title: "No upcoming bookings",
    description: "You have no upcoming bookings. Your upcoming bookings will show up here.",
  },
  unconfirmed: {
    title: "No unconfirmed bookings",
    description: "You have no unconfirmed bookings. Your unconfirmed bookings will show up here.",
  },
  recurring: {
    title: "No recurring bookings",
    description: "You have no recurring bookings. Your recurring bookings will show up here.",
  },
  past: {
    title: "No past bookings",
    description: "You have no past bookings. Your past bookings will show up here.",
  },
  canceled: {
    title: "No canceled bookings",
    description: "You have no canceled bookings. Your canceled bookings will show up here.",
  },
};

export function BookingsList({ bookings, type = "upcoming" }: BookingsListProps) {
  if (bookings.length === 0) {
    const emptyState = emptyStateMessages[type];
    
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="mb-6">
          <Calendar className="h-16 w-16 text-[#9ca3af]" />
        </div>
        <h2 className="text-lg font-semibold text-[#f9fafb] mb-2">
          {emptyState.title}
        </h2>
        <p className="text-sm text-[#9ca3af] text-center max-w-md">
          {emptyState.description}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Section Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[#262626]"></div>
        <span className="text-xs text-[#9ca3af] uppercase">Next</span>
        <div className="flex-1 h-px bg-[#262626]"></div>
      </div>

      {bookings.map((booking) => (
        <BookingCard key={booking.id} {...booking} />
      ))}
    </div>
  );
}
