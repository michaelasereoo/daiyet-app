"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { UserMobileHeader } from "@/components/layout/mobile-header";
import { UserBottomNavigation } from "@/components/layout/bottom-navigation";
import { BookingsList } from "@/components/bookings/BookingsList";
import { SessionRequestCard } from "@/components/user/session-request-card";
import { PaymentModal } from "@/components/user/payment-modal";
import { PaymentSuccessModal } from "@/components/user/payment-success-modal";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useBookingsStream } from "@/hooks/useBookingsStream";
import dayjs from "dayjs";

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
}

export default function UserDashboardPage() {
  const router = useRouter();
  const [sessionRequests, setSessionRequests] = useState<SessionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SessionRequest | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [mealPlansCount, setMealPlansCount] = useState(0);

  // Use SSE for real-time bookings
  const { bookings, isConnected: bookingsConnected, error: bookingsError } = useBookingsStream();
  const [initialBookingsLoaded, setInitialBookingsLoaded] = useState(false);

  // Preload bookings data immediately
  useEffect(() => {
    const fetchInitialBookings = async () => {
      try {
        const response = await fetch("/api/bookings", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          // The hook will update with SSE data, but we preload here for immediate display
          setInitialBookingsLoaded(true);
        }
      } catch (err) {
        console.error("Error preloading bookings:", err);
      }
    };
    fetchInitialBookings();
  }, []);

  // Calculate real-time stats
  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.startTime) >= now
  );
  const totalSessions = bookings.filter((b) => b.status === "CONFIRMED").length;
  const upcomingMeetings = upcomingBookings.length;

  useEffect(() => {
    fetchSessionRequests();
    fetchMealPlansCount();
    
    // Fetch user name for welcome message
    const fetchUserName = () => {
      try {
        const cached = sessionStorage.getItem('userProfile');
        if (cached) {
          const profile = JSON.parse(cached);
          setUserName(profile.name || null);
        }
      } catch (err) {
        console.error("Error reading cached user profile:", err);
      }
    };
    
    // Check immediately
    fetchUserName();
    
    // Also listen for storage events (when sidebar updates the cache)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'userProfile' && e.newValue) {
        try {
          const profile = JSON.parse(e.newValue);
          setUserName(profile.name || null);
        } catch (err) {
          console.error("Error parsing updated user profile:", err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also poll for changes (since storage event only fires from other tabs)
    const interval = setInterval(() => {
      fetchUserName();
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const fetchMealPlansCount = async () => {
    try {
      const response = await fetch("/api/meal-plans", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setMealPlansCount((data.mealPlans || []).filter((p: any) => p.status === "SENT").length);
      }
    } catch (err) {
      console.error("Error fetching meal plans count:", err);
    }
  };

  const fetchSessionRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/user/session-requests", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const requests = data.requests || [];
      
      if (Array.isArray(requests) && requests.length > 0) {
        setSessionRequests(requests);
      } else {
        setSessionRequests([]);
      }
    } catch (err) {
      console.error("Error fetching session requests:", err);
      setError(err instanceof Error ? err.message : "Failed to load requests");
      setSessionRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (request: SessionRequest) => {
    if (request.requestType === "RESCHEDULE_REQUEST") {
      // Navigate to booking page for reschedule
      router.push(
        `/user-dashboard/book-a-call?prefill=true&reschedule=true&requestId=${request.id}&dietitianId=${request.dietitian.id}`
      );
    } else if (request.requestType === "MEAL_PLAN") {
      // Open payment modal for meal plan
      setSelectedRequest(request);
      setIsPaymentModalOpen(true);
    } else if (request.requestType === "CONSULTATION") {
      // Navigate to booking page with pre-fill
      router.push(
        `/user-dashboard/book-a-call?prefill=true&dietitianId=${request.dietitian.id}&eventTypeId=${request.eventType?.id}&requestId=${request.id}&message=${encodeURIComponent(request.message || "")}`
      );
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const response = await fetch(`/api/user/session-requests/${requestId}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        // Remove from list
        setSessionRequests((prev) => prev.filter((req) => req.id !== requestId));
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    if (!selectedRequest) return;

    setIsPaymentModalOpen(false);
    setPaymentData(paymentData);

    try {
      // Call API to approve request and create order
      const response = await fetch(`/api/user/approve-request/${selectedRequest.id}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentData,
        }),
      });

      if (response.ok) {
        // Remove from requests list
        setSessionRequests((prev) => prev.filter((req) => req.id !== selectedRequest.id));
        // Show success modal
        setIsSuccessModalOpen(true);
        
        // Update summary stats
        if (selectedRequest.requestType === "MEAL_PLAN") {
          // Increment meal plans purchased (mock update)
          console.log("Meal plan purchased, incrementing count");
        }
      }
    } catch (err) {
      console.error("Error approving request:", err);
    }
  };

  const handleSuccessModalClose = () => {
    const requestType = selectedRequest?.requestType;
    setIsSuccessModalOpen(false);
    setSelectedRequest(null);
    setPaymentData(null);
    
    if (requestType === "MEAL_PLAN") {
      // Redirect to meal plan page where the approved meal plan will show
      router.push("/user-dashboard/meal-plan");
    } else if (requestType === "CONSULTATION") {
      // Redirect to upcoming meetings where the booking will appear
      router.push("/user-dashboard/upcoming-meetings");
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
        <div className="p-6 lg:p-8 pt-6 lg:pt-8">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-xl lg:text-[15px] font-semibold text-[#f9fafb] mb-1">
              {userName ? `Welcome back, ${userName}!` : "Dashboard"}
            </h1>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Overview of your sessions and meal plans.
            </p>
          </div>

          {/* Book a Call Button */}
          <div className="mb-6">
            <Link href="/user-dashboard/book-a-call">
              <Button className="w-full sm:w-auto bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-3 text-sm font-medium">
                Book a Call
              </Button>
            </Link>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Total Sessions Card */}
            <div className="border border-[#262626] rounded-lg px-4 lg:px-6 py-3 lg:py-4 bg-transparent flex items-center justify-between">
              <div className="text-xs lg:text-sm text-[#9ca3af]">Total Sessions</div>
              <div className="text-xl lg:text-2xl font-semibold text-[#f9fafb]">{totalSessions.toLocaleString()}</div>
            </div>

            {/* Upcoming Meetings Card */}
            <div className="border border-[#262626] rounded-lg px-4 lg:px-6 py-3 lg:py-4 bg-transparent flex items-center justify-between">
              <div className="text-xs lg:text-sm text-[#9ca3af]">Upcoming Meetings</div>
              <div className="text-xl lg:text-2xl font-semibold text-[#f9fafb]">{upcomingMeetings.toLocaleString()}</div>
            </div>

            {/* Meal Plans Purchased Card */}
            <div className="border border-[#262626] rounded-lg px-4 lg:px-6 py-3 lg:py-4 bg-transparent flex items-center justify-between">
              <div className="text-xs lg:text-sm text-[#9ca3af]">Meal Plans Purchased</div>
              <div className="text-xl lg:text-2xl font-semibold text-[#f9fafb]">{mealPlansCount.toLocaleString()}</div>
            </div>
          </div>

          {/* Requested Sessions & Meal Plans Section */}
          <div className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">
              Requested Sessions & Meal Plans
            </h2>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              Approve or reject requests from your dietitians. Click "Approve" to proceed with payment and booking.
            </p>
            {loading ? (
              <div className="text-center py-8">
                <div className="text-[#9ca3af]">Loading requests...</div>
              </div>
            ) : error ? (
              <div className="text-center py-8 border border-red-500/50 rounded-lg bg-red-500/10">
                <p className="text-sm text-red-400 mb-2">Error loading requests</p>
                <p className="text-xs text-[#9ca3af]">{error}</p>
                <p className="text-xs text-[#9ca3af] mt-2">Debug: Check console for details</p>
              </div>
            ) : sessionRequests.length > 0 ? (
              <div className="space-y-4">
                {sessionRequests.map((request) => (
                  <SessionRequestCard
                    key={request.id}
                    request={request}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-[#262626] rounded-lg">
                <Mail className="h-12 w-12 text-[#9ca3af] mx-auto mb-4" />
                <p className="text-sm text-[#9ca3af]">No pending requests.</p>
                <p className="text-xs text-[#9ca3af] mt-1">Requests from your dietitians will appear here.</p>
                <p className="text-xs text-[#9ca3af] mt-2">Debug: sessionRequests.length = {sessionRequests.length}</p>
              </div>
            )}
          </div>

          {/* Upcoming Meetings Section */}
          <div className="mb-6">
            <h2 className="text-[15px] font-semibold text-[#f9fafb] mb-1">Upcoming Meetings</h2>
            <p className="text-[13px] text-[#9ca3af] mb-6">
              See your upcoming meetings and bookings.
            </p>
          </div>

          {/* Bookings List */}
          <BookingsList bookings={upcomingBookings.slice(0, 5)} type="upcoming" />
        </div>
      </main>

      {/* Payment Modal */}
      {selectedRequest && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedRequest(null);
          }}
          onSuccess={handlePaymentSuccess}
          amount={selectedRequest.price || 0}
          currency={selectedRequest.currency || "NGN"}
          description={
            selectedRequest.requestType === "MEAL_PLAN"
              ? selectedRequest.mealPlanType
                ? `Meal Plan: ${selectedRequest.mealPlanType}`
                : "Meal Plan"
              : selectedRequest.eventType?.title || "Consultation"
          }
          requestType={selectedRequest.requestType}
          requestId={selectedRequest.id}
          userEmail={selectedRequest.clientEmail}
          userName={selectedRequest.clientName}
        />
      )}

      {/* Payment Success Modal */}
      {selectedRequest && (
        <PaymentSuccessModal
          isOpen={isSuccessModalOpen}
          onClose={handleSuccessModalClose}
          requestType={selectedRequest.requestType}
          amount={paymentData?.amount || selectedRequest.price || 0}
          currency={paymentData?.currency || selectedRequest.currency || "NGN"}
          onViewDetails={
            selectedRequest.requestType === "MEAL_PLAN"
              ? () => {
                  setIsSuccessModalOpen(false);
                  router.push("/user-dashboard/meal-plan");
                }
              : undefined
          }
        />
      )}
      
      {/* Bottom Navigation - Mobile only */}
      <div className="lg:hidden">
        <UserBottomNavigation />
      </div>
    </div>
  );
}
