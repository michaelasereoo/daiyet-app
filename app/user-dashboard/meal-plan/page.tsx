"use client";

import { useState, useEffect } from "react";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Download, ShoppingCart, Clock } from "lucide-react";
import { PurchaseMealPlanModal } from "@/components/meal-plan/PurchaseMealPlanModal";
import { useMealPlansStream } from "@/hooks/useMealPlansStream";
import { MEAL_PLAN_PACKAGES } from "@/lib/constants/meal-plans";
import { PaymentModal } from "@/components/user/payment-modal";

interface MealPlan {
  id: string;
  packageName: string;
  receivedDate: Date;
  pdfUrl: string;
  status: "pending" | "received" | "paid-pending";
  dieticianName?: string;
  purchasedDate?: Date;
}

interface MealPlanPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

export default function UserMealPlanPage() {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{ id: string; name: string; price: number; currency: string } | null>(null);
  const [pendingPlans, setPendingPlans] = useState<MealPlan[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);

  // Use SSE for real-time meal plans
  const { mealPlans, isConnected, error: mealPlansError } = useMealPlansStream();
  const [initialMealPlansLoaded, setInitialMealPlansLoaded] = useState(false);

  // Preload meal plans data immediately
  useEffect(() => {
    const fetchInitialMealPlans = async () => {
      try {
        const response = await fetch("/api/meal-plans", {
          credentials: "include",
        });
        if (response.ok) {
          setInitialMealPlansLoaded(true);
        }
      } catch (err) {
        console.error("Error preloading meal plans:", err);
      }
    };
    fetchInitialMealPlans();
  }, []);

  // Fetch pending meal plans from session requests
  useEffect(() => {
    const fetchSessionRequests = async () => {
      try {
        const response = await fetch("/api/user/session-requests", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const mealPlanRequests = (data.requests || []).filter(
            (req: any) => req.requestType === "MEAL_PLAN" && req.status === "PENDING"
          );
          setSessionRequests(mealPlanRequests);
          
          // Map to pending plans
          setPendingPlans(
            mealPlanRequests.map((req: any) => ({
              id: req.id,
              packageName: req.mealPlanType || "Custom Meal Plan",
              purchasedDate: new Date(req.createdAt),
              dieticianName: req.dietitian?.name || "Unknown",
              status: "pending" as const,
              receivedDate: new Date(),
              pdfUrl: "",
            }))
          );
        }
      } catch (error) {
        console.error("Error fetching session requests:", error);
      }
    };

    fetchSessionRequests();
  }, []);

  // Separate meal plans into pending and received
  const receivedMealPlans = mealPlans.filter((mp) => mp.status === "SENT" && mp.fileUrl);
  const paidPendingMealPlans = mealPlans.filter((mp) => mp.status === "SENT" && !mp.fileUrl);

  const handlePurchaseClick = (pkg: typeof MEAL_PLAN_PACKAGES[0]) => {
    setSelectedPackage({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      currency: pkg.currency,
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    if (!selectedPackage) return;

    try {
      // Create meal plan record
      const response = await fetch("/api/meal-plans", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "current-user", // Will be determined server-side
          packageName: selectedPackage.name,
          price: selectedPackage.price,
          currency: selectedPackage.currency,
          paymentData,
        }),
      });

      if (response.ok) {
        setIsPaymentModalOpen(false);
        setSelectedPackage(null);
        // Meal plan will appear via SSE stream
      }
    } catch (err) {
      console.error("Error creating meal plan:", err);
    }
  };
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <UserDashboardSidebar />
      <main className="flex-1 bg-[#101010] overflow-y-auto ml-64 rounded-tl-lg">
        <div className="p-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Meal Plans</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Browse available meal plan packages and view your purchased plans.
            </p>
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
                          {plan.packageName}
                        </div>
                        <div className="text-sm text-[#9ca3af] mb-1">
                          {plan.dieticianName && `From: ${plan.dieticianName}`}
                        </div>
                        <div className="text-sm text-[#9ca3af]">
                          {plan.purchasedDate && `Purchased on ${plan.purchasedDate.toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plan.status === "paid-pending" ? (
                          <>
                            <Clock className="h-4 w-4 text-yellow-400" />
                            <span className="text-sm text-yellow-400">Paid & Pending</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-4 w-4 text-[#9ca3af]" />
                            <span className="text-sm text-[#9ca3af]">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <Clock className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No pending meal plans.</p>
              </div>
            )}
          </div>


          {/* Available Packages Section */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">Available Meal Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MEAL_PLAN_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-[#f9fafb] mb-1">
                        {pkg.name}
                      </h3>
                      <p className="text-xs text-[#9ca3af] mb-3">
                        {pkg.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-[#f9fafb]">
                      ₦{pkg.price.toLocaleString()}
                    </div>
                    <Button
                      onClick={() => handlePurchaseClick(pkg)}
                      className="bg-white hover:bg-gray-100 text-black px-4 py-2"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Purchase
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Received Meal Plans Section */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">Received Meal Plans</h2>
            {receivedMealPlans.length > 0 ? (
              <div className="space-y-4">
                {receivedMealPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-[#262626] rounded-lg px-6 py-4 bg-transparent hover:bg-[#171717] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#f9fafb] mb-1">
                          {plan.packageName}
                        </div>
                        <div className="text-sm text-[#9ca3af] mb-1">
                          From: {plan.dietitianName}
                        </div>
                        <div className="text-sm text-[#9ca3af]">
                          Received on {plan.sentAt ? new Date(plan.sentAt).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plan.fileUrl && (
                          <>
                            <Button
                              onClick={() => window.open(plan.fileUrl, '_blank')}
                              variant="outline"
                              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            <Button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = plan.fileUrl!;
                                link.download = `${plan.packageName}.pdf`;
                                link.click();
                              }}
                              variant="outline"
                              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <FileText className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No meal plans received yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Payment Modal */}
      {selectedPackage && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPackage(null);
          }}
          onSuccess={handlePaymentSuccess}
          amount={selectedPackage.price}
          currency={selectedPackage.currency}
          description={`Meal Plan: ${selectedPackage.name}`}
          requestType="MEAL_PLAN"
          userEmail=""
          userName=""
        />
      )}
    </div>
  );
}
