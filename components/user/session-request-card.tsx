"use client";

import { Calendar, FileText, Clock, CheckCircle, XCircle, MessageSquare, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatDietitianName } from "@/lib/utils/dietitian-name";

dayjs.extend(relativeTime);

interface SessionRequest {
  id: string;
  requestType: "CONSULTATION" | "MEAL_PLAN" | "RESCHEDULE_REQUEST";
  clientName: string;
  clientEmail: string;
  message?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RESCHEDULE_REQUESTED";
  eventType?: {
    id: string;
    title: string;
  };
  mealPlanType?: string;
  price?: number;
  currency?: string;
  duration?: number;
  dietitian: {
    id: string;
    name: string;
    email: string;
  };
  originalBookingId?: string;
  createdAt: string;
  mealPlan?: {
    id: string;
    fileUrl: string | null;
    status: string;
    sentAt: string | null;
    hasPdf: boolean;
  } | null;
}

interface SessionRequestCardProps {
  request: SessionRequest;
  onApprove: (request: SessionRequest) => void;
  onReject: (requestId: string) => void;
}

const getMealPlanName = (type: string) => {
  const mealPlans: Record<string, string> = {
    "test": "Test Meal Plan",
    "Test Meal Plan": "Test Meal Plan",
    "7-day": "7-day meal plan",
    "14-day": "14-day meal plan",
    "1-month": "1 month meal plan",
    "smoothie": "Smoothie recipe",
  };
  return mealPlans[type] || type;
};

export function SessionRequestCard({ request, onApprove, onReject }: SessionRequestCardProps) {
  const getRequestIcon = () => {
    if (request.requestType === "CONSULTATION") {
      return <Calendar className="h-5 w-5 text-blue-400" />;
    } else if (request.requestType === "MEAL_PLAN") {
      return <FileText className="h-5 w-5 text-purple-400" />;
    } else {
      return <Clock className="h-5 w-5 text-orange-400" />;
    }
  };

  const getRequestTypeLabel = () => {
    if (request.requestType === "CONSULTATION") {
      return "Consultation";
    } else if (request.requestType === "MEAL_PLAN") {
      return "Meal Plan";
    } else {
      return "Reschedule Request";
    }
  };

  const getRequestTypeColor = () => {
    if (request.requestType === "CONSULTATION") {
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    } else if (request.requestType === "MEAL_PLAN") {
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    } else {
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    }
  };

  const getApproveButtonLabel = () => {
    if (request.requestType === "RESCHEDULE_REQUEST") {
      return "Accept Reschedule";
    }
    return "Approve";
  };

  return (
    <div className="w-full border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            {getRequestIcon()}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#f9fafb]">
                {formatDietitianName(request.dietitian.name)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded border ${getRequestTypeColor()}`}>
                {getRequestTypeLabel()}
              </span>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-2 mb-3">
            {request.requestType === "CONSULTATION" && request.eventType && (
              <>
                <div className="text-sm text-[#9ca3af]">
                  <span className="text-[#D4D4D4]">Event:</span> {request.eventType.title}
                </div>
                {request.price && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Price:</span> ₦{request.price.toLocaleString()} {request.currency || "NGN"}
                  </div>
                )}
                {request.duration && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Duration:</span> {request.duration} minutes
                  </div>
                )}
              </>
            )}

            {request.requestType === "MEAL_PLAN" && request.mealPlanType && (
              <>
                <div className="text-sm text-[#9ca3af]">
                  <span className="text-[#D4D4D4]">Meal Plan:</span> {getMealPlanName(request.mealPlanType)}
                </div>
                {request.price && (
                  <div className="text-sm text-[#9ca3af]">
                    <span className="text-[#D4D4D4]">Price:</span> ₦{request.price.toLocaleString()} {request.currency || "NGN"}
                  </div>
                )}
              </>
            )}

            {request.requestType === "RESCHEDULE_REQUEST" && (
              <div className="text-sm text-[#9ca3af]">
                <span className="text-[#D4D4D4]">Type:</span> Reschedule Request
              </div>
            )}

            {request.message && (
              <div className="bg-[#1a1a1a] border border-[#262626] rounded-md px-3 py-2 mt-2">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-[#9ca3af] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#d1d5db] italic">"{request.message}"</p>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-[#9ca3af]">
            Received {dayjs(request.createdAt).fromNow()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          {request.requestType === "MEAL_PLAN" ? (
            // For user-purchased meal plans, show View PDF button (disabled until dietitian sends)
            <Button
              onClick={() => {
                if (request.mealPlan?.fileUrl) {
                  window.open(request.mealPlan.fileUrl, '_blank');
                }
              }}
              disabled={!request.mealPlan?.hasPdf}
              className={`px-4 py-2 text-sm ${
                request.mealPlan?.hasPdf
                  ? "bg-white hover:bg-gray-100 text-black"
                  : "bg-[#262626] text-[#6b7280] cursor-not-allowed"
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              View PDF
            </Button>
          ) : (
            // For consultation/reschedule requests, show Approve/Reject
            <>
              <Button
                onClick={() => onApprove(request)}
                className="bg-white hover:bg-gray-100 text-black px-4 py-2 text-sm"
              >
                {getApproveButtonLabel()}
              </Button>
              <Button
                onClick={() => onReject(request.id)}
                variant="outline"
                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2 text-sm"
              >
                Reject
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
