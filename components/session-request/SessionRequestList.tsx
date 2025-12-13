"use client";

import { Clock, Calendar, CheckCircle, XCircle, Mail } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface SessionRequest {
  id: string;
  requestType: "CONSULTATION" | "MEAL_PLAN";
  clientName: string;
  clientEmail: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  eventType?: {
    id: string;
    title: string;
  };
  mealPlanType?: string;
  price?: number;
  currency?: string;
  requestedDate?: string;
  createdAt: string;
}

interface SessionRequestListProps {
  requests: SessionRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function SessionRequestList({ requests, onApprove, onReject }: SessionRequestListProps) {
  const getMealPlanName = (type: string) => {
    const mealPlans: Record<string, string> = {
      "7-day": "7-day meal plan",
      "14-day": "14-day meal plan",
      "1-month": "1 month meal plan",
      "smoothie": "Smoothie recipe",
    };
    return mealPlans[type] || type;
  };

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Mail className="h-16 w-16 text-[#9ca3af] mb-6" />
        <h2 className="text-lg font-semibold text-[#f9fafb] mb-2">
          No pending requests
        </h2>
        <p className="text-sm text-[#9ca3af] text-center max-w-md">
          Session requests you send to clients will appear here. Once approved and paid, consultations will appear in your upcoming bookings.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {requests.map((request) => (
        <div
          key={request.id}
          className="w-full border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Header with client info and status */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {request.requestType === "CONSULTATION" ? (
                    <Calendar className="h-4 w-4 text-blue-400" />
                  ) : (
                    <Mail className="h-4 w-4 text-purple-400" />
                  )}
                  <span className="text-sm font-medium text-[#f9fafb]">
                    {request.clientName}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  request.requestType === "CONSULTATION"
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                }`}>
                  {request.requestType === "CONSULTATION" ? "Consultation" : "Meal Plan"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  {request.status}
                </span>
              </div>

              {/* Request details */}
              <div className="space-y-2 mb-3">
                <div className="text-sm text-[#9ca3af]">
                  <span className="text-[#D4D4D4]">Email:</span> {request.clientEmail}
                </div>
                
                {request.requestType === "CONSULTATION" && request.eventType && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Event Type:</span> {request.eventType.title}
                  </div>
                )}

                {request.requestType === "CONSULTATION" && request.requestedDate && (
                  <div className="flex items-center gap-2 text-sm text-[#9ca3af]">
                    <Clock className="h-4 w-4" />
                    <span>
                      {dayjs(request.requestedDate).format("ddd, MMM D, YYYY [at] h:mm A")}
                    </span>
                  </div>
                )}

                {request.requestType === "MEAL_PLAN" && request.mealPlanType && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Meal Plan:</span> {getMealPlanName(request.mealPlanType)}
                  </div>
                )}

                {request.price && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Price:</span> ₦{request.price.toLocaleString()} {request.currency || "NGN"}
                  </div>
                )}

                {request.message && (
                  <div className="bg-[#1a1a1a] border border-[#262626] rounded-md px-3 py-2 mt-2">
                    <p className="text-sm text-[#d1d5db] italic">"{request.message}"</p>
                  </div>
                )}
              </div>

              <div className="text-xs text-[#9ca3af]">
                Sent {dayjs(request.createdAt).fromNow()}
              </div>
            </div>

            {/* Actions - only show for pending */}
            {request.status === "PENDING" && (
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => onReject?.(request.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Reject request"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            )}

            {request.status === "APPROVED" && (
              <div className="ml-4">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
