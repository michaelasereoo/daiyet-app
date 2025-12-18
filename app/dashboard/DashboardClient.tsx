"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { BottomNavigation } from "@/components/layout/bottom-navigation";
import { BookingsList } from "@/components/bookings/BookingsList";
import { SessionRequestList, type SessionRequest } from "@/components/session-request/SessionRequestList";
import { Button } from "@/components/ui/button";
import { Mail, Upload } from "lucide-react";
import Link from "next/link";
import { useSessionRequestsStream } from "@/hooks/useSessionRequestsStream";
import { UploadProgress } from "@/components/ui/upload-progress";

export interface DashboardStats {
  totalSessions: number;
  upcomingSessions: number;
  totalRevenue: number;
}

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
}

interface DashboardClientProps {
  stats: DashboardStats;
  upcomingBookings: Booking[];
  userName?: string;
}

export default function DashboardClient({
  stats,
  upcomingBookings,
  userName,
}: DashboardClientProps) {
  const displayName = userName || "Dietitian";
  
  // Use SSE for real-time session requests (same as session requests page)
  const { requests, isConnected, error: requestsError } = useSessionRequestsStream();
  
  // Filter pending requests and show only first 5
  const pendingRequests = requests
    .filter((r: SessionRequest) => r.status === "PENDING")
    .slice(0, 5);
  
  const loadingRequests = requests.length === 0 && isConnected === false && !requestsError;
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadPdf = async (requestId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsUploading(true);
        try {
          // Find the request to get its details
          const request = pendingRequests.find(r => r.id === requestId);
          if (!request || request.requestType !== "MEAL_PLAN") {
            throw new Error("Request not found or not a meal plan");
          }

          // Upload file
          const formData = new FormData();
          formData.append("file", file);

          console.log("Starting PDF upload...", { fileName: file.name, fileSize: file.size });
          
          const uploadResponse = await fetch("/api/meal-plans/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            console.error("Upload failed:", {
              status: uploadResponse.status,
              error: errorData,
              fullResponse: errorData,
            });
            
            // Show detailed error message
            let errorMessage = errorData.error || "Failed to upload file";
            if (errorData.details) {
              errorMessage += `: ${errorData.details}`;
            }
            if (errorData.buckets) {
              errorMessage += `\n\nAvailable buckets: ${errorData.buckets.join(", ")}`;
            }
            
            throw new Error(errorMessage);
          }

          const uploadData = await uploadResponse.json();
          console.log("Upload successful:", uploadData);

          // Validate that fileUrl exists and is valid
          if (!uploadData.fileUrl || !uploadData.fileUrl.trim()) {
            throw new Error("PDF upload failed: No file URL returned. Please try uploading again.");
          }

          // Verify the URL is valid
          if (!uploadData.fileUrl.startsWith('http://') && !uploadData.fileUrl.startsWith('https://')) {
            throw new Error("PDF upload failed: Invalid file URL. Please try uploading again.");
          }

          // Fetch user ID by email - MUST be a UUID
          const userResponse = await fetch("/api/users/by-email", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ emails: [request.clientEmail.toLowerCase().trim()] }),
          });

          let userId: string | null = null;
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const user = userData.users?.find((u: any) => 
              u.email?.toLowerCase().trim() === request.clientEmail.toLowerCase().trim()
            );
            if (user && user.id) {
              userId = user.id;
              console.log("Found user ID:", userId, "for email:", request.clientEmail);
            }
          }

          if (!userId) {
            console.error("User not found for email:", request.clientEmail);
            throw new Error(`User not found for email: ${request.clientEmail}. Please ensure the user exists in the system.`);
          }

          // Create meal plan - this will only approve if fileUrl is valid
          console.log("Creating meal plan with:", {
            sessionRequestId: requestId,
            userId,
            packageName: request.mealPlanType || "Custom Meal Plan",
            fileUrl: uploadData.fileUrl,
            hasValidFileUrl: !!uploadData.fileUrl && uploadData.fileUrl.startsWith('http'),
          });

          const mealPlanResponse = await fetch("/api/meal-plans", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionRequestId: requestId,
              userId: userId,
              packageName: request.mealPlanType || "Custom Meal Plan",
              fileUrl: uploadData.fileUrl,
              fileName: uploadData.fileName,
            }),
          });

          if (!mealPlanResponse.ok) {
            const errorData = await mealPlanResponse.json();
            console.error("Meal plan creation failed:", {
              status: mealPlanResponse.status,
              error: errorData,
            });
            throw new Error(errorData.error || errorData.details || "Failed to create meal plan");
          }

          const mealPlanData = await mealPlanResponse.json();
          console.log("Meal plan created successfully:", mealPlanData);

          // Verify the meal plan was created with a valid file URL
          if (!mealPlanData.mealPlan?.fileUrl) {
            throw new Error("Meal plan was created but PDF file URL is missing. The request will remain pending. Please try uploading again.");
          }

          console.log("Meal plan created successfully with PDF");
          
          // Show success message
          alert("Meal plan PDF uploaded and sent successfully! The request has been approved.");
          
          // Requests will update automatically via SSE
          // Force a small delay to ensure database changes propagate
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error("Error uploading meal plan PDF:", error);
          alert(error instanceof Error ? error.message : "Failed to upload meal plan PDF");
        } finally {
          // Keep progress visible for a moment, then hide
          setTimeout(() => {
            setIsUploading(false);
          }, 1200);
        }
      }
    };
    input.click();
  };
  
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
              Welcome back, {displayName}!
            </h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Overview of your bookings and revenue.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Total Sessions Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Total Sessions</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {stats.totalSessions.toLocaleString()}
              </div>
            </div>

            {/* Upcoming Sessions Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">
                Upcoming Sessions
              </div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {stats.upcomingSessions.toLocaleString()}
              </div>
            </div>

            {/* Total Revenue Card */}
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Total Revenue</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                ₦{stats.totalRevenue.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Upcoming Meetings Section */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Upcoming Meetings
            </h2>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              See your upcoming meetings and bookings.
            </p>

            {/* Bookings List */}
            {upcomingBookings.length > 0 ? (
              <BookingsList bookings={upcomingBookings} type="upcoming" />
            ) : (
              <div className="text-[#9ca3af] text-sm">No upcoming bookings</div>
            )}
          </div>

          {/* Requested Sessions & Meal Plans Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
                  Requested Sessions & Meal Plans
                </h2>
                <p className="text-[13px] text-[#9ca3af]">
                  View and manage pending requests from your clients.
                </p>
              </div>
              <Link href="/dashboard/session-request">
                <Button
                  variant="outline"
                  className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2 text-sm"
                >
                  View All
                </Button>
              </Link>
            </div>
            {loadingRequests ? (
              <div className="text-center py-8 border border-[#262626] rounded-lg">
                <div className="text-[#9ca3af]">Loading requests...</div>
              </div>
            ) : pendingRequests.length > 0 ? (
              <SessionRequestList
                requests={pendingRequests}
                onUploadPdf={handleUploadPdf}
                onReject={async (id: string) => {
                  try {
                    const response = await fetch(`/api/session-request/${id}`, {
                      method: "PUT",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "REJECTED" }),
                    });
                    if (response.ok) {
                      // Requests will update automatically via SSE
                    }
                  } catch (err) {
                    console.error("Error rejecting request:", err);
                  }
                }}
              />
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <Mail className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No pending requests.</p>
                <p className="text-xs text-[#9ca3af] mt-1">Requests from your clients will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>

      {/* Upload Progress */}
      <UploadProgress 
        isVisible={isUploading} 
        onComplete={() => setIsUploading(false)}
      />
    </div>
  );
}