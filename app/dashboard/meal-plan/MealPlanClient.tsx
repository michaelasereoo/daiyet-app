"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Eye } from "lucide-react";
import { SendMealPlanModal } from "@/components/meal-plan/SendMealPlanModal";

interface MealPlan {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageName: string;
  status: "pending" | "sent";
  pdfUrl?: string;
  uploadedAt?: Date;
}

interface MealPlanClientProps {
  dietitianId: string;
}

export default function MealPlanClient({ dietitianId }: MealPlanClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<MealPlan[]>([]);
  const [sentPlans, setSentPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealPlans();
  }, [dietitianId]);

  const fetchMealPlans = async () => {
    try {
      setLoading(true);

      // Fetch pending meal plans from session requests
      const sessionRequestResponse = await fetch("/api/session-request", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (sessionRequestResponse.ok) {
        const sessionData = await sessionRequestResponse.json();
        const mealPlanRequests = (sessionData.requests || []).filter(
          (req: any) => req.requestType === "MEAL_PLAN" && req.status === "PENDING"
        );

        // Fetch user IDs by email
        const emails = mealPlanRequests.map((req: any) => req.clientEmail);
        const userResponse = await fetch("/api/users/by-email", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ emails }),
        });

        let userMap = new Map<string, string>();
        if (userResponse.ok) {
          const userData = await userResponse.json();
          userMap = new Map((userData.users || []).map((u: any) => [u.email, u.id]));
        }

        const pendingPlansData: MealPlan[] = mealPlanRequests.map((req: any) => ({
          id: req.id,
          userId: userMap.get(req.clientEmail) || req.clientEmail, // Fallback to email if user not found
          userName: req.clientName,
          userEmail: req.clientEmail,
          packageName: req.mealPlanType || "Custom Meal Plan",
          status: "pending" as const,
        }));

        setPendingPlans(pendingPlansData);
      }

      // Fetch sent meal plans from meal_plans table
      const mealPlanResponse = await fetch("/api/meal-plans", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (mealPlanResponse.ok) {
        const mealPlanData = await mealPlanResponse.json();
        const sentPlansData: MealPlan[] = (mealPlanData.mealPlans || [])
          .filter((plan: any) => plan.status === "SENT")
          .map((plan: any) => ({
            id: plan.id,
            userId: plan.userId,
            userName: plan.userName,
            userEmail: plan.userEmail,
            packageName: plan.packageName,
            status: "sent" as const,
            pdfUrl: plan.fileUrl,
            uploadedAt: plan.sentAt ? new Date(plan.sentAt) : undefined,
          }));

        setSentPlans(sentPlansData);
      }
    } catch (error) {
      console.error("Error fetching meal plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMealPlan = async (data: { userId: string; sessionRequestId?: string; packageName: string; file: File }) => {
    try {
      // First, upload the file
      const formData = new FormData();
      formData.append("file", data.file);

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

      // Validate that fileUrl exists and is valid
      if (!uploadData.fileUrl || !uploadData.fileUrl.trim()) {
        throw new Error("PDF upload failed: No file URL returned. Please try uploading again.");
      }

      // Verify the URL is valid
      if (!uploadData.fileUrl.startsWith('http://') && !uploadData.fileUrl.startsWith('https://')) {
        throw new Error("PDF upload failed: Invalid file URL. Please try uploading again.");
      }

      // Then, create the meal plan - this will only approve if fileUrl is valid
      const mealPlanResponse = await fetch("/api/meal-plans", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionRequestId: data.sessionRequestId || null,
          userId: data.userId,
          packageName: data.packageName,
          fileUrl: uploadData.fileUrl,
          fileName: uploadData.fileName,
        }),
      });

      if (!mealPlanResponse.ok) {
        const errorData = await mealPlanResponse.json();
        throw new Error(errorData.error || errorData.details || "Failed to create meal plan");
      }

      const mealPlanData = await mealPlanResponse.json();
      
      // Verify the meal plan was created with a valid file URL
      if (!mealPlanData.mealPlan?.fileUrl) {
        throw new Error("Meal plan was created but PDF file URL is missing. The request will remain pending. Please try uploading again.");
      }

      // Refresh meal plans
      await fetchMealPlans();
    setIsModalOpen(false);
    } catch (error) {
      console.error("Error sending meal plan:", error);
      alert(error instanceof Error ? error.message : "Failed to send meal plan");
    }
  };

  const handleUpload = async (planId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          // Upload file
          const formData = new FormData();
          formData.append("file", file);

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

          // Validate that fileUrl exists and is valid
          if (!uploadData.fileUrl || !uploadData.fileUrl.trim()) {
            throw new Error("PDF upload failed: No file URL returned. Please try uploading again.");
          }

          // Verify the URL is valid
          if (!uploadData.fileUrl.startsWith('http://') && !uploadData.fileUrl.startsWith('https://')) {
            throw new Error("PDF upload failed: Invalid file URL. Please try uploading again.");
          }

          // Find the pending plan to get its details
          const plan = pendingPlans.find(p => p.id === planId);
          if (!plan) {
            throw new Error("Plan not found");
          }

          // Create meal plan from pending request - this will only approve if fileUrl is valid
          const mealPlanResponse = await fetch("/api/meal-plans", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionRequestId: planId,
              userId: plan.userId,
              packageName: plan.packageName,
              fileUrl: uploadData.fileUrl,
              fileName: uploadData.fileName,
            }),
          });

          if (!mealPlanResponse.ok) {
            const errorData = await mealPlanResponse.json();
            throw new Error(errorData.error || errorData.details || "Failed to create meal plan");
          }

          const mealPlanData = await mealPlanResponse.json();
          
          // Verify the meal plan was created with a valid file URL
          if (!mealPlanData.mealPlan?.fileUrl) {
            throw new Error("Meal plan was created but PDF file URL is missing. The request will remain pending. Please try uploading again.");
          }

          // Refresh meal plans
          await fetchMealPlans();
          alert("Meal plan PDF uploaded and sent successfully! The request has been approved.");
        } catch (error) {
          console.error("Error uploading meal plan:", error);
          alert(error instanceof Error ? error.message : "Failed to upload meal plan");
        }
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Meal Plan</h1>
            <p className="text-[13px] text-[#9ca3af]">
              Manage meal plans for your clients.
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2"
          >
            Send Meal Plan
          </Button>
        </div>
      </div>

      {/* Pending Meal Plans Section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">Pending Meal Plans</h2>
        {pendingPlans.length > 0 ? (
          <div className="space-y-4">
            {pendingPlans.map((plan) => (
              <div
                key={plan.id}
                className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#f9fafb] mb-1">
                      {plan.userName}
                    </div>
                    <div className="text-sm text-[#9ca3af] mb-2">
                      {plan.userEmail}
                    </div>
                    <div className="text-sm text-[#d1d5db]">
                      {plan.packageName}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUpload(plan.id)}
                    variant="outline"
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-[#262626] rounded-lg">
            <p className="text-sm text-[#9ca3af]">No pending meal plans.</p>
          </div>
        )}
      </div>

      {/* Sent Meal Plans Section */}
      <div>
        <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">Sent Plans</h2>
        {sentPlans.length > 0 ? (
          <div className="space-y-4">
            {sentPlans.map((plan) => (
              <div
                key={plan.id}
                className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#f9fafb] mb-1">
                      {plan.userName}
                    </div>
                    <div className="text-sm text-[#9ca3af] mb-2">
                      {plan.userEmail}
                    </div>
                    <div className="text-sm text-[#d1d5db]">
                      {plan.packageName}
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (plan.pdfUrl) {
                        window.open(plan.pdfUrl, '_blank');
                      }
                    }}
                    variant="outline"
                    className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-[#262626] rounded-lg">
            <p className="text-sm text-[#9ca3af]">No sent meal plans yet.</p>
          </div>
        )}
      </div>

      {/* Send Meal Plan Modal */}
      <SendMealPlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSend={handleSendMealPlan}
      />
    </div>
  );
}

