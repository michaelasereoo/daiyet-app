"use client";

import { Clock, Calendar, CheckCircle, XCircle, Mail, Upload, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export interface SessionRequest {
  id: string;
  requestType: "CONSULTATION" | "MEAL_PLAN" | "RESCHEDULE_REQUEST";
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
  mealPlan?: {
    id: string;
    fileUrl: string | null;
    status: string;
    sentAt: string | null;
    hasPdf: boolean;
  } | null;
}

interface SessionRequestListProps {
  requests: SessionRequest[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onUploadPdf?: (id: string) => void;
  onSendMealPlan?: (id: string) => void;
  uploadedFiles?: Record<string, { fileUrl: string; fileName: string; storagePath?: string }>;
  isSending?: Record<string, boolean>;
  uploadInProgress?: Record<string, boolean>;
}

export function SessionRequestList({ 
  requests, 
  onApprove, 
  onReject, 
  onUploadPdf,
  onSendMealPlan,
  uploadedFiles = {},
  isSending = {},
  uploadInProgress = {},
}: SessionRequestListProps) {
  // Debug: Log approved meal plans with detailed info
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const approvedMealPlans = requests.filter(r => r.status === "APPROVED" && r.requestType === "MEAL_PLAN");
    if (approvedMealPlans.length > 0) {
      console.group("[SessionRequestList] Approved Meal Plans Debug");
      approvedMealPlans.forEach((r, index) => {
        console.log(`\n=== Meal Plan Request ${index + 1} ===`);
        console.log("Request ID:", r.id);
        console.log("Status:", r.status);
        console.log("Has mealPlan object:", !!r.mealPlan);
        if (r.mealPlan) {
          console.log("Meal Plan ID:", r.mealPlan.id);
          console.log("File URL:", r.mealPlan.fileUrl);
          console.log("File URL type:", typeof r.mealPlan.fileUrl);
          console.log("File URL length:", r.mealPlan.fileUrl?.length || 0);
          console.log("Has PDF:", r.mealPlan.hasPdf);
          console.log("Full mealPlan object:", r.mealPlan);
        } else {
          console.warn("⚠️ mealPlan is NULL or undefined!");
        }
        console.log("Full request object:", r);
      });
      console.groupEnd();
      
      // Log any approved meal plans without PDFs
      const withoutPdf = approvedMealPlans.filter(r => !r.mealPlan?.fileUrl);
      if (withoutPdf.length > 0) {
        console.groupCollapsed("⚠️ Approved meal plans WITHOUT PDF");
        withoutPdf.forEach((r, index) => {
          console.log(`\nRequest ${index + 1}:`, {
            id: r.id,
            mealPlan: r.mealPlan,
            fileUrl: r.mealPlan?.fileUrl,
            hasPdf: r.mealPlan?.hasPdf,
          });
        });
        console.groupEnd();
      }
    }
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
              <div className="flex flex-col items-end gap-2 ml-4">
                {request.requestType === "MEAL_PLAN" ? (
                  // For meal plans, show Upload PDF or Send button
                  <>
                    {uploadedFiles[request.id] ? (
                      <>
                        {/* Show PDF preview */}
                        <div className="text-xs text-[#9ca3af] mb-1 text-right">
                          <FileText className="h-3 w-3 inline mr-1" />
                          {uploadedFiles[request.id].fileName}
                        </div>
                        {/* Show Send button */}
                        <Button
                          onClick={() => onSendMealPlan?.(request.id)}
                          disabled={isSending[request.id]}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
                        >
                          {isSending[request.id] ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => onUploadPdf?.(request.id)}
                        disabled={uploadInProgress[request.id]}
                        className={`bg-white hover:bg-gray-100 text-black px-4 py-2 text-sm ${uploadInProgress[request.id] ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadInProgress[request.id] ? "Uploading..." : "Upload PDF"}
                      </Button>
                    )}
                  </>
                ) : (
                  // For consultations, show reject button
                  <button
                    onClick={() => onReject?.(request.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Reject request"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {request.status === "APPROVED" && (
              <div className="flex items-center gap-2 ml-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-xs text-green-400">Sent</span>
                </div>
                {request.requestType === "MEAL_PLAN" && (
                  <>
                    {request.mealPlan?.fileUrl ? (
                      <Button
                        onClick={() => {
                          if (request.mealPlan?.fileUrl) {
                            window.open(request.mealPlan.fileUrl, '_blank');
                          }
                        }}
                        variant="outline"
                        className="px-4 py-2 text-sm bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
                        title="Click to view PDF in new tab"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View PDF
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded">
                        <FileText className="h-3 w-3" />
                        <span>PDF not available</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
