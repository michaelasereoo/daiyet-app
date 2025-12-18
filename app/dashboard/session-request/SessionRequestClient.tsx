"use client";

import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { SessionRequestList, type SessionRequest } from "@/components/session-request/SessionRequestList";
import { CreateSessionRequestModal } from "@/components/session-request/CreateSessionRequestModal";
import { Button } from "@/components/ui/button";
import { Plus, Wifi, WifiOff, Upload, FileText, CheckCircle, Mail } from "lucide-react";
import { useSessionRequestsStream } from "@/hooks/useSessionRequestsStream";
import { UploadProgress } from "@/components/ui/upload-progress";

export default function SessionRequestClient() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { fileUrl: string; fileName: string; storagePath?: string }>>({});
  const [isSending, setIsSending] = useState<Record<string, boolean>>({});
  
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

  const handleUploadPdf = async (requestId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (uploadInProgress[requestId]) {
          return; // prevent duplicate uploads for same request
        }
        setUploadInProgress(prev => ({ ...prev, [requestId]: true }));
        setIsUploading(true);
        try {
          // Find the request to get its details
          const request = requests.find(r => r.id === requestId);
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

          // Store the uploaded file info - don't create meal plan yet
          setUploadedFiles(prev => ({
            ...prev,
            [requestId]: {
              fileUrl: uploadData.fileUrl,
              fileName: uploadData.fileName,
              storagePath: uploadData.storagePath,
            }
          }));

          console.log("PDF uploaded successfully. Ready to send.");
        } catch (error) {
          console.error("Error uploading meal plan PDF:", error);
          alert(error instanceof Error ? error.message : "Failed to upload meal plan PDF");
        } finally {
          // Keep progress visible for a moment, then hide
          setTimeout(() => {
            setIsUploading(false);
          }, 1200);
          setUploadInProgress(prev => {
            const next = { ...prev };
            delete next[requestId];
            return next;
          });
        }
      }
    };
    input.click();
  };

  const handleSendMealPlan = async (requestId: string) => {
    const uploadedFile = uploadedFiles[requestId];
    if (!uploadedFile) {
      alert("No PDF uploaded. Please upload a PDF first.");
      return;
    }

    setIsSending(prev => ({ ...prev, [requestId]: true }));

    try {
      // Find the request to get its details
      const request = requests.find(r => r.id === requestId);
      if (!request || request.requestType !== "MEAL_PLAN") {
        throw new Error("Request not found or not a meal plan");
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

      // Create meal plan - this will approve the request
      console.log("Sending meal plan with:", {
        sessionRequestId: requestId,
        userId,
        packageName: request.mealPlanType || "Custom Meal Plan",
        fileUrl: uploadedFile.fileUrl,
        fileName: uploadedFile.fileName,
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
          fileUrl: uploadedFile.fileUrl,
          fileName: uploadedFile.fileName,
          storagePath: uploadedFile.storagePath,
        }),
      });

      if (!mealPlanResponse.ok) {
        const errorData = await mealPlanResponse.json();
        console.error("Meal plan creation failed:", {
          status: mealPlanResponse.status,
          error: errorData,
        });
        throw new Error(errorData.error || errorData.details || "Failed to send meal plan");
      }

      const mealPlanData = await mealPlanResponse.json();
      console.log("Meal plan sent successfully:", mealPlanData);

      // Verify the meal plan was created with a valid file URL
      if (!mealPlanData.mealPlan?.fileUrl) {
        throw new Error("Meal plan was created but PDF file URL is missing. Please try again.");
      }

      // Remove from uploaded files since it's now sent
      setUploadedFiles(prev => {
        const newState = { ...prev };
        delete newState[requestId];
        return newState;
      });

      console.log("Meal plan sent successfully");
      
      // Requests will update automatically via SSE
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error sending meal plan:", error);
      alert(error instanceof Error ? error.message : "Failed to send meal plan");
    } finally {
      setIsSending(prev => {
        const newState = { ...prev };
        delete newState[requestId];
        return newState;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
        <DashboardSidebar />
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
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
        <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:ml-64 lg:rounded-tl-lg">
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

  // Filter requests
  const pendingRequests = requests.filter(r => r.status === "PENDING");
  const approvedRequests = requests.filter(r => r.status === "APPROVED");
  const approvedMealPlans = approvedRequests.filter(r => r.requestType === "MEAL_PLAN");
  const approvedConsultations = approvedRequests.filter(r => r.requestType === "CONSULTATION");
  const totalRequests = requests.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      <DashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Session Requests</h1>
                <p className="text-[13px] text-[#9ca3af] mb-6">
                  Manage session requests and meal plans from your clients.
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Total Requests</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {totalRequests.toLocaleString()}
              </div>
            </div>
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Approved Requests</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {approvedConsultations.length.toLocaleString()}
              </div>
            </div>
            <div className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent">
              <div className="text-sm text-[#9ca3af] mb-2">Approved Meal Plans</div>
              <div className="text-2xl font-semibold text-[#f9fafb]">
                {approvedMealPlans.length.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Requested Sessions & Meal Plans Section */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Requested Sessions & Meal Plans
            </h2>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              View and manage pending requests from your clients. Upload PDFs for meal plans or approve consultations.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-200">{error}</p>
              </div>
            )}
            {pendingRequests.length > 0 ? (
              <SessionRequestList
                requests={pendingRequests}
                onApprove={handleApprove}
                onReject={handleReject}
                onUploadPdf={handleUploadPdf}
                onSendMealPlan={handleSendMealPlan}
                uploadedFiles={uploadedFiles}
                isSending={isSending}
                uploadInProgress={uploadInProgress}
              />
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <Mail className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No pending requests.</p>
              </div>
            )}
          </div>

          {/* Approved Meal Plans and Session Requests Section */}
          {approvedRequests.length > 0 && (
            <div className="mb-6">
              <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
                Approved Meal Plans and Session Requests
              </h2>
              <p className="text-[13px] text-[#9ca3af] mb-6">
                View all approved requests and meal plans.
              </p>
              <SessionRequestList
                requests={approvedRequests}
                onApprove={handleApprove}
                onReject={handleReject}
                onUploadPdf={handleUploadPdf}
              />
            </div>
          )}
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

      {/* Upload Progress */}
      <UploadProgress 
        isVisible={isUploading} 
        onComplete={() => setIsUploading(false)}
      />
    </div>
  );
}

