"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, FileText, Video, ExternalLink, Clock } from "lucide-react";
import dayjs from "dayjs";

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestType: "CONSULTATION" | "MEAL_PLAN";
  amount: number;
  currency: string;
  onViewDetails?: () => void;
  bookingDetails?: {
    id: string;
    date: Date;
    time: string;
    dietician: string;
    duration: string;
    meetingLink?: string;
  };
}

export function PaymentSuccessModal({
  isOpen,
  onClose,
  requestType,
  amount,
  currency,
  onViewDetails,
  bookingDetails,
}: PaymentSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-[#f9fafb] mb-2">Payment Successful!</h2>
          <p className="text-sm text-[#9ca3af] mb-6">
            Your payment of ₦{amount.toLocaleString()} {currency} has been processed successfully.
          </p>

          <div className="bg-[#0a0a0a] border border-[#262626] rounded-lg p-4 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 mb-2">
              {requestType === "CONSULTATION" ? (
                <Calendar className="h-5 w-5 text-blue-400" />
              ) : (
                <FileText className="h-5 w-5 text-purple-400" />
              )}
              <span className="text-sm font-medium text-[#f9fafb]">
                {requestType === "CONSULTATION" ? "Consultation Booking" : "Meal Plan"} Confirmed
              </span>
            </div>
            
            {bookingDetails && requestType === "CONSULTATION" && (
              <>
                <div className="flex items-center gap-3 pt-2 border-t border-[#262626]">
                  <Calendar className="h-4 w-4 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Date</div>
                    <div className="text-sm text-[#f9fafb]">
                      {dayjs(bookingDetails.date).format("MMM D, YYYY")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Time</div>
                    <div className="text-sm text-[#f9fafb]">{bookingDetails.time}</div>
                  </div>
                </div>
                {bookingDetails.meetingLink && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[#262626]">
                    <Video className="h-4 w-4 text-[#9ca3af]" />
                    <div className="flex-1">
                      <div className="text-xs text-[#9ca3af] mb-1">Meeting Link</div>
                      <a
                        href={bookingDetails.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline flex items-center gap-1 break-all"
                      >
                        {bookingDetails.meetingLink}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!bookingDetails && (
              <>
                {requestType === "CONSULTATION" ? (
                  <p className="text-xs text-[#9ca3af] mt-1">
                    Your booking will appear in your upcoming meetings once confirmed.
                  </p>
                ) : (
                  <p className="text-xs text-[#9ca3af] mt-1">
                    Your meal plan will appear in the pending section and will be delivered soon.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {bookingDetails?.meetingLink && requestType === "CONSULTATION" && (
              <Button
                onClick={() => window.open(bookingDetails.meetingLink, '_blank')}
                className="bg-white hover:bg-gray-100 text-black px-6 py-2 w-full"
              >
                Join Meeting
              </Button>
            )}
            {onViewDetails && (
              <Button
                onClick={onViewDetails}
                className={bookingDetails?.meetingLink ? "bg-transparent border border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-6 py-2 w-full" : "bg-white hover:bg-gray-100 text-black px-6 py-2 w-full"}
              >
                {requestType === "CONSULTATION" ? "View Booking" : "View Meal Plan"}
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="outline"
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-6 py-2 w-full"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
