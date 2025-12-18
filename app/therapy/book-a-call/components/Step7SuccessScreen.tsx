"use client";

import { Button } from "@/components/ui/button";
import { Check, Calendar as CalendarIcon, Clock, Video, ExternalLink } from "lucide-react";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

interface Step7SuccessScreenProps {
  bookingDetails: {
    date: Date;
    time: string;
    therapist: string;
    duration: string;
    meetingLink?: string;
  };
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
}

export function Step7SuccessScreen({ bookingDetails }: Step7SuccessScreenProps) {
  const router = useRouter();
  
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-white mb-2">Booking Confirmed!</h2>
      <p className="text-sm text-[#9ca3af] mb-6">Your booking has been confirmed</p>
      
      <div className="border border-[#262626] rounded-lg p-6 space-y-4 text-left max-w-md mx-auto mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
          <div>
            <div className="text-xs text-[#9ca3af]">Date</div>
            <div className="text-sm text-white">
              {dayjs(bookingDetails.date).format("MMM D, YYYY")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#9ca3af]" />
          <div>
            <div className="text-xs text-[#9ca3af]">Time</div>
            <div className="text-sm text-white">{formatTime(bookingDetails.time)}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#9ca3af]" />
          <div>
            <div className="text-xs text-[#9ca3af]">Duration</div>
            <div className="text-sm text-white">{bookingDetails.duration}</div>
          </div>
        </div>
        {bookingDetails.meetingLink && (
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-[#9ca3af]" />
            <div>
              <div className="text-xs text-[#9ca3af]">Meeting Link</div>
              <a
                href={bookingDetails.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline flex items-center gap-1"
              >
                {bookingDetails.meetingLink}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-3 max-w-md mx-auto">
        {bookingDetails.meetingLink && (
          <Button
            onClick={() => window.open(bookingDetails.meetingLink, '_blank')}
            className="w-full bg-white hover:bg-gray-100 text-black px-6 py-2"
          >
            Join Meeting
          </Button>
        )}
        <Button
          onClick={() => router.push("/user-dashboard")}
          className="w-full bg-white hover:bg-gray-100 text-black px-6 py-2"
        >
          Go to Dashboard
        </Button>
        <Button
          onClick={() => router.push("/therapy")}
          variant="outline"
          className="w-full bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
        >
          Back to Therapy Home
        </Button>
      </div>
    </div>
  );
}

