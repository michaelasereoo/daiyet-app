"use client";

import { useState, useRef, useEffect } from "react";
import { 
  MoreVertical, 
  Video, 
  Clock, 
  Send, 
  MapPin, 
  Users, 
  Camera, 
  Info, 
  ClipboardCheck, 
  Flag, 
  XCircle 
} from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { RequestRescheduleModal } from "./RequestRescheduleModal";

interface BookingCardProps {
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

export function BookingCard({
  id,
  date,
  startTime,
  endTime,
  title,
  description,
  message,
  participants,
  meetingLink,
  eventTypeSlug,
}: BookingCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const formattedDate = dayjs(date).format("ddd, D MMM");
  const formattedStartTime = dayjs(startTime).format("h:mma").toLowerCase();
  const formattedEndTime = dayjs(endTime).format("h:mma").toLowerCase();

  // Detect event type from slug or title for badge display
  const getEventTypeTag = () => {
    const slug = eventTypeSlug?.toLowerCase() || "";
    const titleLower = title.toLowerCase();
    
    if (slug === "free-trial-consultation" || titleLower.includes("free trial") || titleLower.includes("free-trial")) {
      return { label: "Free Trial", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    }
    if (slug === "1-on-1-consultation-with-licensed-dietician" || titleLower.includes("1-on-1") || titleLower.includes("1 on 1")) {
      return { label: "1-on-1", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    }
    if (slug === "monitoring" || titleLower.includes("monitoring")) {
      return { label: "Monitoring", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" };
    }
    return null;
  };

  const eventTypeTag = getEventTypeTag();

  return (
    <div 
      className="w-full border border-[#262626] rounded-lg px-6 py-4 transition-colors mb-4"
      style={{ 
        backgroundColor: isHovered ? '#171717' : 'transparent'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Date and Time */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-sm font-medium text-[#f9fafb]">
                {formattedDate}
              </div>
              {eventTypeTag && (
                <span className={`text-xs px-2 py-0.5 rounded ${eventTypeTag.color} border border-current/20`}>
                  {eventTypeTag.label}
                </span>
              )}
            </div>
            <div className="text-sm text-[#A2A2A2] mb-2">
              {formattedStartTime} - {formattedEndTime}
            </div>
            {meetingLink ? (
              <Button
                variant="outline"
                size="sm"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] text-xs h-7 px-3 mb-3"
                onClick={() => window.open(meetingLink, '_blank')}
              >
                <Video className="h-3 w-3 mr-1.5" />
                Join Google Meet
              </Button>
            ) : (
              <div className="text-xs text-[#9ca3af] mb-3">
                Meeting link will be available soon
              </div>
            )}
          </div>

          {/* Event Description */}
          <div className="text-sm text-[#d1d5db] mb-3">
            {description}
          </div>

          {/* Quote Bubble */}
          {message && (
            <div className="bg-[#1a1a1a] border border-[#262626] rounded-md px-3 py-2 mb-3">
              <p className="text-sm text-[#d1d5db] italic">"{message}"</p>
            </div>
          )}

          {/* Participants */}
          <div className="text-sm text-[#A2A2A2]">
            {participants.join(" and ")}
          </div>
        </div>

        {/* Ellipsis Menu */}
        <div className="relative flex items-center ml-6" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors p-1"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-50 w-56 bg-[#171717] border border-[#262626] rounded-lg shadow-lg py-2">
              {/* Edit event section */}
              <div className="px-2 mb-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase">
                  Edit event
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement reschedule booking
                    console.log("Reschedule booking:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  Reschedule booking
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    setIsRescheduleModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#f9fafb] hover:bg-[#262626] rounded transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Request reschedule
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement edit location
                    console.log("Edit location:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  Edit location
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement add guests
                    console.log("Add guests:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <Users className="h-4 w-4" />
                  Add guests
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#262626] my-2"></div>

              {/* After event section */}
              <div className="px-2 mb-1">
                <div className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase">
                  After event
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement view recordings
                    console.log("View recordings:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  View recordings
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement view session details
                    console.log("View Session Details:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <Info className="h-4 w-4" />
                  View Session Details
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement mark as no-show
                    console.log("Mark as no-show:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Mark as no-show
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#262626] my-2"></div>

              {/* Actions section */}
              <div className="px-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement report booking
                    console.log("Report booking:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#9ca3af] opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <Flag className="h-4 w-4" />
                  Report booking
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    // TODO: Implement cancel event
                    console.log("Cancel event:", id);
                  }}
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400/50 opacity-50 cursor-not-allowed rounded transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel event
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Reschedule Modal */}
      <RequestRescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => setIsRescheduleModalOpen(false)}
        onConfirm={(reason) => {
          console.log("Request reschedule for booking:", id, "Reason:", reason);
          setIsRescheduleModalOpen(false);
          // TODO: Implement API call to request reschedule
        }}
        bookingTitle={title}
      />
    </div>
  );
}
