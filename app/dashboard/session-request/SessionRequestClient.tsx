"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SessionRequestList } from "@/components/session-request/SessionRequestList";
import { CreateSessionRequestModal } from "@/components/session-request/CreateSessionRequestModal";
import { Button } from "@/components/ui/button";
import { Plus, Wifi, WifiOff } from "lucide-react";
import { useSessionRequestsStream } from "@/hooks/useSessionRequestsStream";

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

export default function SessionRequestClient() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Use SSE for real-time session requests
  const { requests, isConnected, error } = useSessionRequestsStream();
  
  const loading = requests.length === 0 && isConnected === false && !error;

  const handleApprove = async (id: string) => {
    // TODO: Implement approve action
    console.log("Approve request:", id);
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/session-request/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "REJECTED" }),
      });

      if (response.ok) {
        // Requests will update automatically via SSE
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
          <div className="p-8">
            <div className="text-white">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Session Requests</h1>
              <p className="text-[13px] text-[#9ca3af] mb-6">
                Send session requests to clients. They can approve by paying. Approved consultations will appear in upcoming bookings.
              </p>
            </div>
            <div className="text-red-300 bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="font-semibold mb-1">Error loading session requests</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Filter to show only pending requests
  const pendingRequests = requests.filter(r => r.status === "PENDING");

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Session Requests</h1>
                <p className="text-[13px] text-[#9ca3af] mb-6">
                  Send session requests to clients. They can approve by paying. Approved consultations will appear in upcoming bookings.
                </p>
              </div>
              {/* Connection Status */}
              <div className="flex items-center gap-2 text-xs">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400">Reconnecting...</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Action Bar */}
            <div className="flex items-center justify-end">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-white hover:bg-gray-100 text-black px-4 py-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Send New Request
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-200">{error}</p>
            </div>
          )}

          {/* Session Requests List */}
          <SessionRequestList
            requests={requests}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      </main>

      {/* Create Session Request Modal */}
      <CreateSessionRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          // Requests will update automatically via SSE
        }}
      />
    </div>
  );
}

