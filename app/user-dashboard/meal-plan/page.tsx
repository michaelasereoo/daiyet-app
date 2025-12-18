"use client";

import { useState, useEffect } from "react";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { UserMobileHeader } from "@/components/layout/mobile-header";
import { UserBottomNavigation } from "@/components/layout/bottom-navigation";
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
  hasPdf?: boolean;
  mealPlanId?: string;
}

interface MealPlanPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
}

interface SelectedPurchase {
  packageId: string;
  packageName: string;
  price: number;
  currency: string;
  dietitianId: string;
  dietitianName: string;
}

export default function UserMealPlanPage() {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{ id: string; name: string; price: number; currency: string } | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<SelectedPurchase | null>(null);
  const [pendingPlans, setPendingPlans] = useState<MealPlan[]>([]);
  const [sessionRequests, setSessionRequests] = useState<any[]>([]);
  const [signupSource, setSignupSource] = useState<string | null>(null);

  // Fetch signup_source to determine labels
  useEffect(() => {
    const fetchSignupSource = async () => {
      try {
        const response = await fetch("/api/user/profile", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.signup_source) {
            setSignupSource(data.profile.signup_source);
          }
        }
      } catch (err) {
        console.error("Error fetching signup source:", err);
      }
    };
    fetchSignupSource();
  }, []);

  // Determine labels based on signup_source
  const pageTitle = signupSource === "therapy" ? "Assessment Tests" : "Meal Plans";
  const pageDescription = signupSource === "therapy" 
    ? "Browse available assessment test packages and view your purchased tests."
    : "Browse available meal plan packages and view your purchased meal plans.";
  const pendingSectionTitle = signupSource === "therapy" ? "Pending Assessment Tests" : "Pending Meal Plans";
  const availableSectionTitle = signupSource === "therapy" ? "Available Assessment Tests" : "Available Meal Plans";
  const receivedSectionTitle = signupSource === "therapy" ? "Received Assessment Tests" : "Received Meal Plans";

  // Use SSE for real-time meal plans (handles both USER and DIETITIAN roles)
  const { mealPlans, isConnected, error: mealPlansError } = useMealPlansStream();

  // Handle payment success from Paystack redirect
  useEffect(() => {
    const handlePaymentCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment");
      const reference = urlParams.get("reference");

      console.log("[MEAL PLAN] Checking payment callback:", { paymentStatus, reference });

      if (paymentStatus === "success" && reference) {
        console.log("[MEAL PLAN] Payment successful, reference:", reference);
        
        // Verify payment and get payment details
        try {
          const verifyResponse = await fetch("/api/payments/verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference }),
          });

          if (verifyResponse.ok) {
            const paymentData = await verifyResponse.json();
            console.log("Payment verified:", paymentData);

            // Get payment metadata to find the purchase details
            const { data: payment } = await fetch("/api/payments", {
              credentials: "include",
            }).then(r => r.json()).catch(() => ({ data: null }));

            // Try to get purchase details from localStorage (stored before redirect)
            const storedPurchase = localStorage.getItem("pendingMealPlanPurchase");
            console.log("[MEAL PLAN] Stored purchase from localStorage:", storedPurchase);
            
            if (storedPurchase) {
              try {
                const purchase = JSON.parse(storedPurchase);
                console.log("[MEAL PLAN] Parsed purchase:", purchase);
                
                // Create session request
                const response = await fetch("/api/user/session-requests", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    dietitianId: purchase.dietitianId,
                    requestType: "MEAL_PLAN" as const,
                    mealPlanType: purchase.packageName,
                    notes: `Meal Plan Purchase: ${purchase.packageName}`,
                    paymentData: { reference },
                    price: purchase.price,
                    currency: purchase.currency,
                  }),
                });

                const responseData = await response.json();
                if (response.ok) {
                  console.log("✅ Session request created successfully:", responseData);
                  localStorage.removeItem("pendingMealPlanPurchase");
                  // Clean URL params
                  window.history.replaceState({}, "", "/user-dashboard/meal-plan");
                  // Refresh to show new request
                  window.location.reload();
                } else {
                  console.error("❌ Failed to create session request:", responseData);
                  alert(`Payment successful, but failed to create request: ${responseData.error || "Unknown error"}`);
                }
              } catch (err) {
                console.error("Error parsing stored purchase:", err);
              }
            } else {
              console.warn("No stored purchase found, payment was successful but can't create request");
              alert("Payment successful! Please contact support if your meal plan request doesn't appear.");
            }
          }
        } catch (error) {
          console.error("Error verifying payment:", error);
        }
      }
    };

    handlePaymentCallback();
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
          // Filter meal plan requests that are still pending (not sent yet)
          // Exclude meal plans that have been sent (have PDF) - they should be in Received section
          const mealPlanRequests = (data.requests || []).filter(
            (req: any) => 
              req.requestType === "MEAL_PLAN" && 
              req.status === "PENDING" &&
              !req.mealPlan?.hasPdf // Exclude if PDF has been sent
          );
          setSessionRequests(mealPlanRequests);
          
          // Map to pending plans with meal plan info
          setPendingPlans(
            mealPlanRequests.map((req: any) => ({
              id: req.id,
              packageName: req.mealPlanType || "Custom Meal Plan",
              purchasedDate: new Date(req.createdAt),
              dieticianName: req.dietitian?.name || "Unknown",
              status: "pending" as const,
              receivedDate: new Date(),
              pdfUrl: req.mealPlan?.fileUrl || "",
              hasPdf: req.mealPlan?.hasPdf || false,
              mealPlanId: req.mealPlan?.id,
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
  
  // Also check session requests for meal plans that should be in received section
  // (sent by dietitian or older than 24 hours)
  const now = new Date();
  const receivedFromRequests = sessionRequests.filter((req: any) => {
    if (req.requestType === "MEAL_PLAN") {
      // Include if it has PDF (sent by dietitian)
      if (req.mealPlan?.hasPdf) {
        return true;
      }
      // Include if older than 24 hours
      const createdAt = new Date(req.createdAt);
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return true;
      }
    }
    return false;
  });

  // Step 1: User clicks Purchase - opens dietitian selection modal
  const handlePurchaseClick = (pkg: typeof MEAL_PLAN_PACKAGES[0]) => {
    setSelectedPackage({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      currency: pkg.currency,
    });
    setIsPurchaseModalOpen(true);
  };

  // Step 2: User selects dietitian and clicks "Go to Checkout" - opens payment modal
  const handleCheckout = (data: { dietitianId: string; dietitianName: string; packageName: string; packageId: string; price: number }) => {
    const purchase = {
      packageId: data.packageId,
      packageName: data.packageName,
      price: data.price,
      currency: selectedPackage?.currency || "NGN",
      dietitianId: data.dietitianId,
      dietitianName: data.dietitianName,
    };
    
    setSelectedPurchase(purchase);
    
    // Store purchase in localStorage before redirect (for payment callback)
    localStorage.setItem("pendingMealPlanPurchase", JSON.stringify(purchase));
    
    setIsPurchaseModalOpen(false);
    setIsPaymentModalOpen(true);
  };

  // Step 3: Payment success - create session request for the dietitian
  const handlePaymentSuccess = async (paymentData: any) => {
    if (!selectedPurchase) {
      console.error("No purchase selected");
      return;
    }

    try {
      console.log("Creating session request after payment:", {
        dietitianId: selectedPurchase.dietitianId,
        packageName: selectedPurchase.packageName,
        price: selectedPurchase.price,
        paymentReference: paymentData?.reference,
      });

      // Create a session request for the meal plan
      const response = await fetch("/api/user/session-requests", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dietitianId: selectedPurchase.dietitianId,
          requestType: "MEAL_PLAN" as const,
          mealPlanType: selectedPurchase.packageName,
          notes: `Meal Plan Purchase: ${selectedPurchase.packageName}`,
          paymentData,
          price: selectedPurchase.price,
          currency: selectedPurchase.currency,
        }),
      });

      const responseData = await response.json();
      
      if (response.ok) {
        console.log("✅ Session request created successfully:", responseData);
        setIsPaymentModalOpen(false);
        setSelectedPackage(null);
        setSelectedPurchase(null);
        // Refresh session requests to show the new pending plan
        window.location.reload();
      } else {
        console.error("❌ Failed to create session request:", {
          status: response.status,
          error: responseData,
        });
        alert(
          `Failed to create session request: ${responseData.error || responseData.message || "Unknown error"}\n\n` +
          `Please check the console for details or contact support if the issue persists.`
        );
      }
    } catch (err) {
      console.error("❌ Error creating meal plan request:", err);
      alert(
        `Error creating meal plan request: ${err instanceof Error ? err.message : "Unknown error"}\n\n` +
        `Your payment was successful, but we couldn't create the request. Please contact support.`
      );
    }
  };
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Mobile Header - Only on mobile */}
      <div className="lg:hidden">
        <UserMobileHeader />
      </div>
      
      {/* Sidebar - Hidden on mobile, always visible on desktop */}
      <UserDashboardSidebar />
      
      {/* Main Content */}
      <main className="flex-1 bg-[#101010] overflow-y-auto w-full lg:w-auto lg:ml-64 lg:rounded-tl-lg pb-16 lg:pb-0">
        <div className="p-6 lg:p-8 pt-14 lg:pt-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-xl lg:text-[15px] font-semibold text-[#f9fafb] mb-1">{pageTitle}</h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              {pageDescription}
            </p>
          </div>

          {/* Pending Section */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">{pendingSectionTitle}</h2>
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
                        <Button
                          onClick={() => {
                            if (plan.hasPdf && plan.pdfUrl) {
                              window.open(plan.pdfUrl, '_blank');
                            }
                          }}
                          disabled={!plan.hasPdf}
                          className={`px-4 py-2 text-sm ${
                            plan.hasPdf
                              ? "bg-white hover:bg-gray-100 text-black"
                              : "bg-[#262626] text-[#6b7280] cursor-not-allowed"
                          }`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <Clock className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No pending assessment tests.</p>
              </div>
            )}
          </div>


          {/* Available Packages Section */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">{availableSectionTitle}</h2>
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

          {/* Received Assessment Tests Section */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[#f9fafb] mb-4">{receivedSectionTitle}</h2>
            {(receivedMealPlans.length > 0 || receivedFromRequests.length > 0) ? (
              <div className="space-y-4">
                {/* Meal plans from meal_plans table */}
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
                <p className="text-sm text-[#9ca3af]">No assessment tests received yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation - Mobile only */}
      <div className="lg:hidden">
        <UserBottomNavigation />
      </div>

      {/* Purchase Modal - Select Dietitian */}
      <PurchaseMealPlanModal
        isOpen={isPurchaseModalOpen}
        onClose={() => {
          setIsPurchaseModalOpen(false);
          setSelectedPackage(null);
        }}
        selectedPackage={selectedPackage}
        onCheckout={handleCheckout}
      />

      {/* Payment Modal */}
      {selectedPurchase && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPurchase(null);
            setSelectedPackage(null);
          }}
          onSuccess={handlePaymentSuccess}
          amount={selectedPurchase.price}
          currency={selectedPurchase.currency}
          description={`Meal Plan: ${selectedPurchase.packageName} (from ${selectedPurchase.dietitianName})`}
          requestType="MEAL_PLAN"
          userEmail=""
          userName=""
        />
      )}
    </div>
  );
}
