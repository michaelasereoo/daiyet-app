"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { UserDashboardSidebar } from "@/components/layout/user-dashboard-sidebar";
import { UserMobileHeader } from "@/components/layout/mobile-header";
import { UserBottomNavigation } from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PaymentModal } from "@/components/user/payment-modal";
import { PaymentSuccessModal } from "@/components/user/payment-success-modal";
import { ChevronLeft, ChevronRight, Check, Calendar as CalendarIcon, Clock, Video, ExternalLink, X, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import dayjs from "dayjs";
import { useOptimizedAvailability } from "@/hooks/useOptimizedAvailability";

interface Dietician {
  id: string;
  name: string;
  qualification: string;
  profileImage?: string;
  description: string;
}

// Dietitians will be fetched from API

function BookACallPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPrefill = searchParams.get("prefill") === "true";
  const isReschedule = searchParams.get("reschedule") === "true";
  const prefillDietitianId = searchParams.get("dietitianId");
  const prefillEventTypeId = searchParams.get("eventTypeId");
  const prefillRequestId = searchParams.get("requestId");
  const prefillMessage = searchParams.get("message");

  // Skip to step 3 (date/time) if pre-filled from consultation request (dietitian already selected)
  // Skip to step 3 if reschedule (all fields pre-filled, just need new date/time)
  const initialStep = isPrefill && prefillDietitianId ? 3 : isReschedule ? 3 : 1;
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(initialStep); // 5 is success screen
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    age: "",
    occupation: "",
    medicalCondition: "",
    monthlyFoodBudget: "",
    complaint: "",
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookingHistory, setBookingHistory] = useState<any>(null);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");
  
  // Preloaded default event types with fixed pricing
  const defaultEventTypes = [
    {
      id: "free-trial-consultation",
      title: "Free Trial Consultation",
      slug: "free-trial-consultation",
      description: "Get insights into why you need to see a dietician.",
      length: 15,
      price: 0,
      currency: "NGN"
    },
    {
      id: "1-on-1-consultation-with-licensed-dietician",
      title: "1-on-1 Consultation with Licensed Dietician",
      slug: "1-on-1-consultation-with-licensed-dietician",
      description: "Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]",
      length: 45,
      price: 15000,
      currency: "NGN"
    },
    {
      id: "monitoring",
      title: "Monitoring",
      slug: "monitoring",
      description: "Monitoring consultation",
      length: 20,
      price: 5000,
      currency: "NGN"
    },
    {
      id: "test-event",
      title: "Test Event",
      slug: "test-event",
      description: "Test event for payment testing",
      length: 15,
      price: 100,
      currency: "NGN"
    }
  ];
  
  // Initialize with default event types (free-trial, 1-on-1, and test-event)
  const initialAvailableTypes = defaultEventTypes.filter(et => 
    et.slug === "free-trial-consultation" || 
    et.slug === "1-on-1-consultation-with-licensed-dietician" ||
    et.slug === "test-event"
  );
  
  const [availableEventTypes, setAvailableEventTypes] = useState<Array<{ id: string; title: string; slug: string; length: number; price: number; currency: string; description: string }>>(initialAvailableTypes);
  const [isEventTypeDropdownOpen, setIsEventTypeDropdownOpen] = useState(false);
  
  // Initialize event types and selected type on mount
  useEffect(() => {
    if (!selectedEventTypeId && initialAvailableTypes.length > 0) {
      setEventTypes(defaultEventTypes);
      setSelectedEventTypeId(initialAvailableTypes[0].id);
      setEventTypePrice(initialAvailableTypes[0].price);
    }
  }, []);
  const [selectedDietician, setSelectedDietician] = useState<string>(prefillDietitianId || "");
  const [viewingProfile, setViewingProfile] = useState<Dietician | null>(null);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [eventTypePrice, setEventTypePrice] = useState<number>(15000);
  const [dietitianName, setDietitianName] = useState<string>("");
  const [dietitians, setDietitians] = useState<Dietician[]>([]);
  const [loadingDietitians, setLoadingDietitians] = useState(true);
  const [eventTypes, setEventTypes] = useState<Array<{ id: string; title: string; length: number; price: number; currency: string }>>([]);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>(prefillEventTypeId || "");

  // Real availability data
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  // Initialize availableDates from cache if available
  const [availableDates, setAvailableDates] = useState<string[]>(() => {
    // Try to load from cache on mount if dietitian is already selected
    if (typeof window !== "undefined" && prefillDietitianId) {
      try {
        const cacheKey = `availability_${prefillDietitianId}_${prefillEventTypeId || 'default'}_${dayjs().format('YYYY-MM')}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 300000) {
            const dates = new Set(
              (parsed.slots || [])
                .filter((slot: any) => {
                  const slotDate = dayjs(slot.start);
                  return slotDate.isSame(dayjs(), "month");
                })
                .map((slot: any) => dayjs(slot.start).format("D"))
            );
            console.log('⚡ [INSTANT] Loaded dates from cache on mount:', Array.from(dates));
            return Array.from(dates);
          }
        }
      } catch (err) {
        console.warn('⚠️ [INSTANT] Error loading cache on mount:', err);
      }
    }
    return [];
  });
  
  // Get event type duration for smart polling
  const selectedEventType = eventTypes.find(et => et.id === selectedEventTypeId);
  const durationMinutes = selectedEventType?.length || 45;
  
  // Smart polling for timeslots (only when all required data is available)
  const { data: availabilityData, isLoading: isLoadingAvailability } = useOptimizedAvailability({
    dietitianId: selectedDietician || "",
    eventTypeId: selectedEventTypeId || undefined,
    startDate: selectedDate ? new Date(selectedDate) : undefined,
    endDate: selectedDate ? dayjs(selectedDate).add(1, "day").toDate() : undefined,
    durationMinutes,
    enabled: !!selectedDate && !!selectedDietician && !!selectedEventTypeId,
  });
  
  // This is now handled in handleDateClick for instant display

  // Update timeSlots when availability data changes (from hook)
  useEffect(() => {
    if (availabilityData && selectedDate) {
      const formattedSlots = (availabilityData.slots || [])
        .filter((slot: any) => {
          const slotDate = dayjs(slot.start);
          return slotDate.isSame(dayjs(selectedDate), "day");
        })
        .map((slot: any) => dayjs(slot.start).format("HH:mm"));
      setTimeSlots(formattedSlots);
      setLoadingTimeSlots(false);
      
      // Cache the data for future use
      if (selectedDietician && selectedEventTypeId) {
        const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${dayjs(selectedDate).format('YYYY-MM')}`;
        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify({
            slots: availabilityData.slots || [],
            timestamp: Date.now(),
            timezone: availabilityData.timezone
          }));
        }
      }
    } else if (isLoadingAvailability) {
      setLoadingTimeSlots(true);
    }
  }, [availabilityData, selectedDate, isLoadingAvailability, selectedDietician, selectedEventTypeId]);

  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const handlePreviousMonth = () => {
    const newMonth = dayjs(currentMonth).subtract(1, "month");
    setCurrentMonth(newMonth);
    
    // INSTANT: Load dates from cache for new month
    if (selectedDietician && selectedEventTypeId) {
      const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${newMonth.format('YYYY-MM')}`;
      const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 300000) {
            const dates = new Set(
              (parsed.slots || [])
                .filter((slot: any) => {
                  const slotDate = dayjs(slot.start);
                  return slotDate.isSame(newMonth, "month");
                })
                .map((slot: any) => dayjs(slot.start).format("D"))
            );
            setAvailableDates(Array.from(dates));
            console.log('⚡ [INSTANT] Dates loaded from cache for previous month:', Array.from(dates));
            return; // Don't fetch if we have cache
          }
        } catch (err) {
          console.warn('⚠️ [INSTANT] Error reading cache:', err);
        }
      }
    }
  };

  const handleNextMonth = () => {
    const newMonth = dayjs(currentMonth).add(1, "month");
    setCurrentMonth(newMonth);
    
    // INSTANT: Load dates from cache for new month
    if (selectedDietician && selectedEventTypeId) {
      const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${newMonth.format('YYYY-MM')}`;
      const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 300000) {
            const dates = new Set(
              (parsed.slots || [])
                .filter((slot: any) => {
                  const slotDate = dayjs(slot.start);
                  return slotDate.isSame(newMonth, "month");
                })
                .map((slot: any) => dayjs(slot.start).format("D"))
            );
            setAvailableDates(Array.from(dates));
            console.log('⚡ [INSTANT] Dates loaded from cache for next month:', Array.from(dates));
            return; // Don't fetch if we have cache
          }
        } catch (err) {
          console.warn('⚠️ [INSTANT] Error reading cache:', err);
        }
      }
    }
  };

  const handleDateClick = (day: number) => {
    const date = currentMonth.date(day).toDate();
    setSelectedDate(date);
    setSelectedTime(""); // Reset time when date changes
    
    // INSTANT: Try to load from cache first
    if (selectedDietician && selectedEventTypeId) {
      const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${dayjs(date).format('YYYY-MM')}`;
      const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
      
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 300000) {
            const formattedSlots = (parsed.slots || [])
              .filter((slot: any) => {
                const slotDate = dayjs(slot.start);
                return slotDate.isSame(dayjs(date), "day");
              })
              .map((slot: any) => dayjs(slot.start).format("HH:mm"));
            
            if (formattedSlots.length > 0) {
              console.log('⚡ [INSTANT] Time slots loaded from cache:', formattedSlots.length);
              setTimeSlots(formattedSlots);
              setLoadingTimeSlots(false);
              return; // Don't fetch if we have cache
            }
          }
        } catch (err) {
          console.warn('⚠️ [INSTANT] Error reading cache:', err);
        }
      }
    }
    
    // If no cache, fetch via hook
    if (selectedDietician) {
      fetchTimeSlotsForDate(date);
    }
  };

  // Legacy function kept for compatibility, but smart polling hook handles it now
  const fetchTimeSlotsForDate = async (date: Date) => {
    // This is now handled by useOptimizedAvailability hook
    // Keeping for backward compatibility
    setSelectedDate(date);
  };

  // INSTANT PRELOAD: Fetch availability IMMEDIATELY when dietitian is selected (don't wait for currentMonth)
  useEffect(() => {
    if (selectedDietician && selectedEventTypeId) {
      const fetchAvailableDates = async () => {
        try {
          // Check cache first for instant display
          const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${currentMonth.format('YYYY-MM')}`;
          const cached = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
          
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Date.now() - parsed.timestamp < 300000) {
                // Use cached data immediately
                const currentMonthDates = new Set(
                  (parsed.slots || [])
                    .filter((slot: any) => {
                      const slotDate = dayjs(slot.start);
                      return slotDate.isSame(currentMonth, "month");
                    })
                    .map((slot: any) => dayjs(slot.start).format("D"))
                );
                setAvailableDates(Array.from(currentMonthDates));
                console.log('⚡ [INSTANT] Dates loaded from cache:', Array.from(currentMonthDates));
                
                // Still fetch fresh data in background
                fetchFreshData();
                return;
              }
            } catch (err) {
              console.warn('⚠️ [INSTANT] Error reading cache:', err);
            }
          }
          
          // No cache, fetch immediately
          fetchFreshData();
        } catch (err) {
          console.error("❌ [INSTANT] Error in preload:", err);
        }
      };

      const fetchFreshData = async () => {
        try {
          // Preload current month + next month for faster UX
          const startOfCurrentMonth = currentMonth.startOf("month").format("YYYY-MM-DD");
          const endOfNextMonth = currentMonth.add(1, "month").endOf("month").format("YYYY-MM-DD");
          const duration = selectedEventType?.length || 45;
          const url = `/api/availability/timeslots?dietitianId=${selectedDietician}&startDate=${startOfCurrentMonth}&endDate=${endOfNextMonth}&duration=${duration}&eventTypeId=${selectedEventTypeId}`;
          
          console.log('📅 [PRELOAD] Fetching availability for 2 months:', {
            startDate: startOfCurrentMonth,
            endDate: endOfNextMonth,
            dietitianId: selectedDietician,
            eventTypeId: selectedEventTypeId,
            duration
          });
          
          const response = await fetch(url, {
            credentials: "include",
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ [PRELOAD] Availability data received:', {
              slotsCount: data.slots?.length || 0,
              timezone: data.timezone
            });
            
            // Extract unique dates that have available slots for current month
            const currentMonthDates = new Set(
              (data.slots || [])
                .filter((slot: any) => {
                  const slotDate = dayjs(slot.start);
                  return slotDate.isSame(currentMonth, "month");
                })
                .map((slot: any) => dayjs(slot.start).format("D"))
            );
            
            // Store all slots in a cache for quick lookup when date is selected
            if (typeof window !== "undefined") {
              const cacheKey = `availability_${selectedDietician}_${selectedEventTypeId}_${currentMonth.format('YYYY-MM')}`;
              localStorage.setItem(cacheKey, JSON.stringify({
                slots: data.slots || [],
                timestamp: Date.now(),
                timezone: data.timezone
              }));
              console.log('💾 [PRELOAD] Cached availability data:', cacheKey);
            }
            
            setAvailableDates(Array.from(currentMonthDates));
            console.log('📊 [PRELOAD] Available dates set:', Array.from(currentMonthDates));
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ [PRELOAD] Fetch failed:', {
              status: response.status,
              error: errorData.error
            });
          }
        } catch (err) {
          console.error("❌ [PRELOAD] Error fetching available dates:", err);
        }
      };

      fetchAvailableDates();
    }
  }, [selectedDietician, selectedEventTypeId, selectedEventType, currentMonth]);


  // Fetch dietitians on component mount
  useEffect(() => {
    const fetchDietitians = async () => {
      try {
        setLoadingDietitians(true);
        const response = await fetch("/api/dietitians", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setDietitians(data.dietitians || []);
        } else {
          console.error("Failed to fetch dietitians:", response.statusText);
        }
      } catch (err) {
        console.error("Error fetching dietitians:", err);
      } finally {
        setLoadingDietitians(false);
      }
    };

    fetchDietitians();
  }, []);

  // Fetch real event type IDs from database when dietitian is selected
  useEffect(() => {
    if (selectedDietician && availableEventTypes.length > 0) {
      const fetchRealEventTypes = async () => {
        try {
          const response = await fetch(`/api/event-types?dietitianId=${selectedDietician}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const realEventTypes = data.eventTypes || [];
            
            // Match preloaded types with real types by slug and update IDs
            setAvailableEventTypes(prevTypes => {
              const matchedTypes = prevTypes.map(preloadedType => {
                const realType = realEventTypes.find((rt: any) => rt.slug === preloadedType.slug);
                if (realType) {
                  return {
                    ...preloadedType,
                    id: realType.id, // Use real database ID
                    description: realType.description || preloadedType.description,
                  };
                }
                return preloadedType;
              });
              
              // Update selected event type ID if it's still using a slug
              if (selectedEventTypeId && selectedEventTypeId.length < 36) {
                // It might be a slug, find the real ID
                const matched = matchedTypes.find(et => et.slug === selectedEventTypeId || et.id === selectedEventTypeId);
                if (matched && matched.id !== selectedEventTypeId) {
                  setSelectedEventTypeId(matched.id);
                }
              }
              
              return matchedTypes;
            });
            
            setEventTypes(realEventTypes);
          }
        } catch (err) {
          console.error("Error fetching real event types:", err);
        }
      };
      
      fetchRealEventTypes();
    }
  }, [selectedDietician]);

  const isDateAvailable = (day: number) => {
    const dateStr = currentMonth.date(day).format("D");
    return availableDates.includes(dateStr);
  };

  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    return dayjs(selectedDate).isSame(currentMonth.date(day), "day");
  };

  const isToday = (day: number) => {
    return dayjs().isSame(currentMonth.date(day), "day");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleCheckout = async () => {
    if (selectedDate && selectedTime && selectedDietician && selectedEventTypeId) {
      // This will be handled by handleCheckoutClick which opens payment modal
      // After payment, booking will be created via API
    }
  };

  // Debug: Log formData and userProfile changes
  useEffect(() => {
    console.log('🔍 [DEBUG] formData/userProfile state:', {
      formDataName: formData.name,
      formDataEmail: formData.email,
      userProfileName: userProfile?.name,
      userProfileEmail: userProfile?.email,
      hasUserProfile: !!userProfile
    });
  }, [formData.name, formData.email, userProfile]);

  // Handle payment callback from Paystack
  useEffect(() => {
    try {
      const paymentStatus = searchParams.get("payment");
      const paymentRef = searchParams.get("reference");

      if (!paymentStatus) return; // No payment callback, skip

      if (paymentStatus === "success" && paymentRef) {
        // Verify payment and show success screen
        const verifyPayment = async () => {
          try {
            const response = await fetch("/api/payments/verify", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ reference: paymentRef }),
            });

            if (response.ok) {
              const data = await response.json();
              const payment = data.payment;
              
              if (payment?.booking_id) {
                // Fetch booking details
                const bookingResponse = await fetch(`/api/bookings/${payment.booking_id}`, {
                  credentials: "include",
                });

                if (bookingResponse.ok) {
                  const bookingData = await bookingResponse.json();
                  const booking = bookingData.booking;
                  
                  if (!booking) {
                    console.error("Booking not found in response");
                    return;
                  }
                  
                  // Find dietitian name (use fetched dietitians or fetch if needed)
                  let dietitianName = "";
                  if (dietitians.length > 0) {
                    dietitianName = dietitians.find((d) => d.id === booking.dietitian_id)?.name || "";
                  }
                  
                  // Find event type duration
                  let duration = "45m";
                  if (eventTypes.length > 0) {
                    const eventType = eventTypes.find(et => et.id === booking.event_type_id);
                    duration = `${eventType?.length || 45}m`;
                  }
                  
                  // Parse date using dayjs to avoid timezone issues
                  const bookingDate = dayjs(booking.start_time);
                  
                  // Set booking details for success screen
                  setBookingDetails({
                    id: booking.id,
                    date: bookingDate.toDate(),
                    time: bookingDate.format("HH:mm"),
                    dietician: dietitianName,
                    duration: duration,
                    meetingLink: booking.meeting_link || "",
                  });
                  
                  // Set payment data for modal
                  setPaymentData({
                    amount: payment.amount || eventTypePrice,
                    currency: payment.currency || "NGN",
                  });
                  
                  // Show success modal immediately (don't show page first)
                  setIsSuccessModalOpen(true);
                  
                  // Clean URL (use setTimeout to avoid hydration issues)
                  setTimeout(() => {
                    router.replace("/user-dashboard/book-a-call", { scroll: false });
                  }, 100);
                } else {
                  console.error("Failed to fetch booking:", await bookingResponse.text());
                }
              }
            } else {
              console.error("Failed to verify payment:", await response.text());
            }
          } catch (err) {
            console.error("Error verifying payment:", err);
          }
        };

        verifyPayment();
      } else if (paymentStatus === "error") {
        const errorMsg = searchParams.get("message");
        console.error("Payment error:", errorMsg);
        // Could show error message to user
        setTimeout(() => {
          router.replace("/user-dashboard/book-a-call", { scroll: false });
        }, 100);
      }
    } catch (err) {
      console.error("Error in payment callback handler:", err);
    }
  }, [searchParams, router]);

  // Load user data, profile, and booking history - RUN IMMEDIATELY ON MOUNT
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Get name and email from session as fallback
          const extractedSessionName =
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            "";
          const extractedSessionEmail = session.user.email || "";

          // Store session data in state so it's always available
          setSessionName(extractedSessionName);
          setSessionEmail(extractedSessionEmail);

          console.log('👤 [DEBUG] Loading user profile:', {
            sessionName: extractedSessionName,
            sessionEmail: extractedSessionEmail,
            userId: session.user.id
          });

          // Fetch user profile data
          const profileResponse = await fetch("/api/user/profile", {
            credentials: "include",
          });
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log('✅ [DEBUG] Profile data received:', {
              hasProfile: !!profileData.profile,
              profileName: profileData.profile?.name,
              profileEmail: profileData.profile?.email
            });
            
            setUserProfile(profileData.profile);
            
            // Pre-fill form with profile data if available
            // Priority: profile data > session metadata > empty string
            if (profileData.profile) {
              const finalName = profileData.profile.name || extractedSessionName || "";
              const finalEmail = profileData.profile.email || extractedSessionEmail || "";
              
              console.log('📝 [DEBUG] Setting formData:', {
                finalName,
                finalEmail,
                source: {
                  name: profileData.profile.name ? 'database' : extractedSessionName ? 'session' : 'empty',
                  email: profileData.profile.email ? 'database' : extractedSessionEmail ? 'session' : 'empty'
                }
              });
              
              setFormData((prev) => ({
                ...prev,
                // Use profile name/email from database first, then session, then keep existing
                name: finalName,
                email: finalEmail,
                age: profileData.profile.age?.toString() || prev.age,
                occupation: profileData.profile.occupation || prev.occupation,
                medicalCondition: profileData.profile.medical_condition || prev.medicalCondition,
                monthlyFoodBudget: profileData.profile.monthly_food_budget?.toString() || prev.monthlyFoodBudget,
                complaint: isPrefill && prefillMessage ? decodeURIComponent(prefillMessage) : (profileData.profile.complaint || prev.complaint),
              }));
            } else {
              console.log('⚠️ [DEBUG] No profile data, using session:', { sessionName: extractedSessionName, sessionEmail: extractedSessionEmail });
              setFormData((prev) => ({
                ...prev,
                name: extractedSessionName || prev.name || "",
                email: extractedSessionEmail || prev.email || "",
                complaint: isPrefill && prefillMessage ? decodeURIComponent(prefillMessage) : prev.complaint,
              }));
            }
          } else {
            const errorData = await profileResponse.json().catch(() => ({}));
            console.error('❌ [DEBUG] Profile fetch failed:', {
              status: profileResponse.status,
              error: errorData
            });
            // If no profile, just set name and email from session
            setFormData((prev) => ({
              ...prev,
              name: extractedSessionName || prev.name || "",
              email: extractedSessionEmail || prev.email || "",
              complaint: isPrefill && prefillMessage ? decodeURIComponent(prefillMessage) : prev.complaint,
            }));
          }

          // Fetch booking history to determine available event types
          const historyResponse = await fetch("/api/user/booking-history", {
            credentials: "include",
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setBookingHistory(historyData);
            
            // Filter default event types based on booking history
            const bookedSlugs = historyData.bookedEventTypes || [];
            let filteredTypes = defaultEventTypes;
            
            if (bookedSlugs.includes("free-trial-consultation") || bookedSlugs.includes("free-trial")) {
              // After free trial, only 1-on-1 available
              filteredTypes = defaultEventTypes.filter(et => 
                et.slug === "1-on-1-consultation-with-licensed-dietician"
              );
            } else if (bookedSlugs.includes("1-on-1-consultation-with-licensed-dietician") || bookedSlugs.includes("1-on-1") || bookedSlugs.includes("one-on-one")) {
              // After 1-on-1, add monitoring
              filteredTypes = defaultEventTypes.filter(et => 
                et.slug === "1-on-1-consultation-with-licensed-dietician" || 
                et.slug === "monitoring"
              );
            } else {
              // Initially: only free-trial and 1-on-1
              filteredTypes = defaultEventTypes.filter(et => 
                et.slug === "free-trial-consultation" || 
                et.slug === "1-on-1-consultation-with-licensed-dietician"
              );
            }
            
            // Always include test-event regardless of booking history
            const testEvent = defaultEventTypes.find(et => et.slug === "test-event");
            if (testEvent && !filteredTypes.find(et => et.slug === "test-event")) {
              filteredTypes.push(testEvent);
            }
            
            setEventTypes(defaultEventTypes);
            setAvailableEventTypes(filteredTypes);
            
            // Auto-select first available event type
            if (filteredTypes.length > 0 && !selectedEventTypeId) {
              setSelectedEventTypeId(filteredTypes[0].id);
              setEventTypePrice(filteredTypes[0].price);
            }
          } else {
            // If no booking history, show free-trial and 1-on-1 by default
            let filteredTypes = defaultEventTypes.filter(et => 
              et.slug === "free-trial-consultation" || 
              et.slug === "1-on-1-consultation-with-licensed-dietician"
            );
            
            // Always include test-event regardless of booking history
            const testEvent = defaultEventTypes.find(et => et.slug === "test-event");
            if (testEvent && !filteredTypes.find(et => et.slug === "test-event")) {
              filteredTypes.push(testEvent);
            }
            
            setEventTypes(defaultEventTypes);
            setAvailableEventTypes(filteredTypes);
            if (filteredTypes.length > 0 && !selectedEventTypeId) {
              setSelectedEventTypeId(filteredTypes[0].id);
              setEventTypePrice(filteredTypes[0].price);
            }
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      }

      // Fetch event type price and dietitian info if pre-filling from consultation request
      if (isPrefill) {
        // Fetch event type price if eventTypeId is provided
        if (prefillEventTypeId && !isReschedule) {
          try {
            const response = await fetch(`/api/event-types/${prefillEventTypeId}`, {
              credentials: "include",
            });
            if (response.ok) {
              const data = await response.json();
              if (data.eventType?.price) {
                setEventTypePrice(data.eventType.price);
              }
            }
          } catch (err) {
            console.error("Error fetching event type:", err);
          }
        }

        // Fetch dietitian information if dietitianId is provided
        if (prefillDietitianId) {
          let foundName = false;
          
          // First, try to get from session request if requestId is available
          if (prefillRequestId) {
            try {
              const requestResponse = await fetch(`/api/user/session-requests`, {
                credentials: "include",
              });
              if (requestResponse.ok) {
                const requestData = await requestResponse.json();
                const matchingRequest = requestData.requests?.find(
                  (req: any) => req.id === prefillRequestId
                );
                if (matchingRequest?.dietitian?.name) {
                  setDietitianName(matchingRequest.dietitian.name);
                  foundName = true;
                }
              }
            } catch (err) {
              console.error("Error fetching from session requests:", err);
            }
          }

          // Fallback: fetch directly from dietitian API if we didn't get it from session request
          if (!foundName) {
            try {
              const response = await fetch(`/api/user/dietitian/${prefillDietitianId}`, {
                credentials: "include",
              });
              if (response.ok) {
                const data = await response.json();
                if (data.dietitian?.name) {
                  setDietitianName(data.dietitian.name);
                  foundName = true;
                }
              }
            } catch (err) {
              console.error("Error fetching dietitian:", err);
            }
          }

          // Final fallback: try to find in fetched dietitians
          if (!foundName && dietitians.length > 0) {
            const dietitian = dietitians.find(d => d.id === prefillDietitianId);
            if (dietitian) {
              setDietitianName(dietitian.name);
            }
          }
        }
      }
    };

    loadUserData();
  }, [isPrefill, prefillMessage, prefillEventTypeId, isReschedule, prefillDietitianId, prefillRequestId, dietitians]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes}${ampm}`;
  };

  const handleCheckoutClick = async () => {
    if (isReschedule) {
      // For reschedule, skip payment and directly confirm
      handleRescheduleConfirmation();
    } else {
      // For regular booking, create booking first, then open payment modal
      if (selectedDate && selectedTime && selectedDietician && selectedEventTypeId) {
      // Validate email and name before proceeding
      // Priority: formData > userProfile > session data
      const finalEmail = formData.email || userProfile?.email || sessionEmail;
      const finalName = formData.name || userProfile?.name || sessionName;
        
        if (!finalEmail) {
          alert("Email is required for payment. Please enter your email address.");
          return;
        }
        
        if (!finalName) {
          alert("Name is required for payment. Please enter your name.");
          return;
        }

        try {
          // Create booking first (with PENDING status)
          const bookingResponse = await fetch("/api/bookings", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dietitianId: selectedDietician,
              eventTypeId: selectedEventTypeId || prefillEventTypeId,
              startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
              name: finalName,
              email: finalEmail,
              notes: formData.complaint,
              userAge: formData.age ? parseInt(formData.age) : null,
              userOccupation: formData.occupation || null,
              userMedicalCondition: formData.medicalCondition || null,
              userMonthlyFoodBudget: formData.monthlyFoodBudget ? parseFloat(formData.monthlyFoodBudget) : null,
              userComplaint: formData.complaint || null,
              sessionRequestId: prefillRequestId,
              // No payment data yet - will be added after payment
            }),
          });

          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            // Store booking ID for payment
            setBookingDetails({
              id: bookingData.booking?.id || `booking-${Date.now()}`,
              date: selectedDate,
              time: selectedTime,
              dietician: dietitians.find((d) => d.id === selectedDietician)?.name || "",
              duration: `${eventTypes.find(et => et.id === selectedEventTypeId)?.length || 45}m`,
              meetingLink: "",
            });
            // Now open payment modal with booking ID
            setIsPaymentModalOpen(true);
          } else {
            const errorData = await bookingResponse.json().catch(() => ({}));
            console.error("Failed to create booking:", errorData);
            alert("Failed to create booking. Please try again.");
          }
        } catch (err) {
          console.error("Error creating booking:", err);
          alert("Error creating booking. Please try again.");
        }
      } else {
        // Missing required fields
        alert("Please select date, time, and dietitian before proceeding.");
      }
    }
  };

  const handleRescheduleConfirmation = async () => {
    if (selectedDate && selectedTime && selectedDietician && prefillRequestId) {
      try {
        // Call API to update booking with new date/time
        const response = await fetch(`/api/user/reschedule-booking/${prefillRequestId}`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newDate: selectedDate.toISOString(),
            newTime: selectedTime,
          }),
        });

        if (response.ok) {
          const dietician = mockDieticians.find((d) => d.id === selectedDietician);
          setBookingDetails({
            date: selectedDate,
            time: selectedTime,
            dietician: dietician?.name || "",
            duration: "45m",
            meetingLink: "https://meet.google.com/abc-defg-hij",
            isReschedule: true,
          });
          setStep(5);
        }
      } catch (err) {
        console.error("Error confirming reschedule:", err);
      }
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    setIsPaymentModalOpen(false);
    setPaymentData(paymentData);

    if (selectedDate && selectedTime && selectedDietician) {
      // Use fallback for email and name
      // Priority: formData > userProfile > session data
      const finalEmail = formData.email || userProfile?.email || sessionEmail;
      const finalName = formData.name || userProfile?.name || sessionName;
      
      if (!finalEmail || !finalName) {
        alert("Email and name are required. Please ensure your profile is complete.");
        return;
      }

      try {
        // Create booking
        const response = await fetch("/api/bookings", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dietitianId: selectedDietician,
            eventTypeId: selectedEventTypeId || prefillEventTypeId,
            startTime: new Date(`${dayjs(selectedDate).format("YYYY-MM-DD")}T${selectedTime}`).toISOString(),
            name: finalName,
            email: finalEmail,
            notes: formData.complaint,
            userAge: formData.age ? parseInt(formData.age) : null,
            userOccupation: formData.occupation || null,
            userMedicalCondition: formData.medicalCondition || null,
            userMonthlyFoodBudget: formData.monthlyFoodBudget ? parseFloat(formData.monthlyFoodBudget) : null,
            userComplaint: formData.complaint || null,
            sessionRequestId: prefillRequestId,
            paymentData,
          }),
        });

        if (response.ok) {
          const dietician = dietitians.find((d) => d.id === selectedDietician);
          const selectedEventType = eventTypes.find(et => et.id === selectedEventTypeId);
          const data = await response.json();
          setBookingDetails({
            id: data.booking?.id || `booking-${Date.now()}`,
            date: selectedDate,
            time: selectedTime,
            dietician: dietician?.name || "",
            duration: `${selectedEventType?.length || 45}m`,
            meetingLink: data.booking?.meeting_link || "",
          });
          setIsSuccessModalOpen(true);
          
          // Save/update user profile data
          try {
            const profileResponse = await fetch("/api/user/profile", {
              method: "PUT",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                age: formData.age ? parseInt(formData.age) : null,
                occupation: formData.occupation || null,
                medical_condition: formData.medicalCondition || null,
                monthly_food_budget: formData.monthlyFoodBudget ? parseFloat(formData.monthlyFoodBudget) : null,
              }),
            });
            if (!profileResponse.ok) {
              console.error("Failed to save profile:", await profileResponse.text());
            }
          } catch (profileErr) {
            console.error("Error saving profile:", profileErr);
          }
          
          // Update session request status
          if (prefillRequestId) {
            console.log(`Session request ${prefillRequestId} approved and booking created`);
          }
        }
      } catch (err) {
        console.error("Error creating booking:", err);
      }
    }
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false);
    router.push("/user-dashboard/upcoming-meetings");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Mobile Header */}
      <UserMobileHeader onMenuClick={() => setSidebarOpen(true)} />
      
      {/* Sidebar - Hidden on mobile, opens from menu */}
      <UserDashboardSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 bg-[#101010] overflow-y-auto lg:ml-64 rounded-tl-lg flex items-center justify-center p-4 lg:p-8 pb-20 lg:pb-8 pt-14 lg:pt-8 w-full">
        {/* Modal-like Container */}
        <div className="w-full max-w-7xl bg-[#171717] border border-[#262626] rounded-lg shadow-xl">
          {/* Step Indicator */}
          {step < 5 && (
            <div className="border-b border-[#262626] px-8 py-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((s) => {
                  // Hide step 2 (dietitian selection) if pre-filled from consultation request
                  if (s === 2 && isPrefill && prefillDietitianId && !isReschedule) {
                    return null;
                  }
                  return (
                    <div key={s} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          step >= s || (s === 2 && isPrefill && prefillDietitianId)
                            ? "bg-white text-black"
                            : "bg-[#262626] text-[#9ca3af]"
                        }`}
                      >
                        {s}
                      </div>
                      {s < 4 && (
                        <div
                          className={`w-12 h-0.5 ${
                            step > s || (s === 2 && isPrefill && prefillDietitianId)
                              ? "bg-white"
                              : "bg-[#262626]"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step Content - Center Aligned */}
          {step === 1 && (
            <div className="flex justify-center p-8">
              <div className="w-full max-w-5xl grid grid-cols-2 divide-x divide-[#262626]">
                {/* Left Pane - Service Information */}
                <div className="p-8 space-y-6">
                  {/* Logo and Brand */}
                  <div className="flex items-center gap-2 mb-4">
                    <Image
                      src="/daiyet logo.svg"
                      alt="Daiyet"
                      width={100}
                      height={30}
                      className="h-6 w-auto"
                    />
                  </div>

              {/* Service Title and Description */}
              <div>
                <div className="flex items-start gap-2 mb-4 relative">
                  <h2 className="text-2xl font-semibold text-[#f9fafb] leading-tight">
                    {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.title || availableEventTypes[0]?.title || "1-on-1 Consultation with Licensed Dietician"}
                </h2>
                  
                  {/* Event Type Selection Dropdown Icon */}
                  {availableEventTypes.length > 0 && (
                    <div className="relative event-type-dropdown flex items-center pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEventTypeDropdownOpen(!isEventTypeDropdownOpen)}
                        className="text-[#f9fafb] hover:text-[#d4d4d4] transition-colors"
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform ${isEventTypeDropdownOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {isEventTypeDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 bg-[#171717] border border-[#262626] rounded-lg shadow-xl z-50 min-w-[300px]">
                          {availableEventTypes.map((et) => {
                            const isSelected = selectedEventTypeId === et.id;
                            return (
                              <button
                                key={et.id}
                                type="button"
                                onClick={() => {
                                  setSelectedEventTypeId(et.id);
                                  setEventTypePrice(et.price);
                                  setIsEventTypeDropdownOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                                  isSelected 
                                    ? "bg-[#404040] text-[#f9fafb] font-medium" 
                                    : "text-[#f9fafb] hover:bg-[#262626]"
                                }`}
                              >
                                <div className="font-medium">{et.title}</div>
                                <div className="text-xs text-[#9ca3af] mt-1">
                                  {et.length}m • ₦{et.price.toLocaleString()}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-[#9ca3af] leading-relaxed mb-6">
                  {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.description || availableEventTypes[0]?.description || "Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]"}
                </p>
              </div>

              {/* Service Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[#9ca3af]" />
                  <span className="text-sm text-[#f9fafb]">
                    {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.length || availableEventTypes[0]?.length || 45}m
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-[#9ca3af]" />
                  <span className="text-sm text-[#f9fafb]">Google Meet</span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#f9fafb]">Africa/Lagos</span>
                    <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                  </div>
                </div>
                {(selectedEventTypeId || availableEventTypes.length > 0) && (
                  <div className="bg-white rounded-lg px-6 py-4 mt-3 w-fit">
                    <span className="text-2xl font-semibold text-black">
                      {eventTypePrice === 0 ? "Free" : `₦${eventTypePrice.toLocaleString()}`}
                    </span>
                  </div>
                )}
                  </div>
                </div>

                {/* Middle Pane - Enter Information */}
                <div className="p-8">
                  <div>
                    <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Enter your information</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                          Age
                        </label>
                        <Input
                          type="number"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                          className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                          placeholder="Enter your age"
                          min="1"
                          max="120"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                          Occupation
                        </label>
                        <Input
                          type="text"
                          value={formData.occupation}
                          onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                          className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                          placeholder="Enter your occupation"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                          Medical Condition
                        </label>
                        <Textarea
                          value={formData.medicalCondition}
                          onChange={(e) => setFormData({ ...formData, medicalCondition: e.target.value })}
                          rows={3}
                          className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                          placeholder="Any medical conditions or health concerns..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                          Monthly Food Budget (NGN)
                        </label>
                        <Input
                          type="number"
                          value={formData.monthlyFoodBudget}
                          onChange={(e) => setFormData({ ...formData, monthlyFoodBudget: e.target.value })}
                          className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                          placeholder="Enter your monthly food budget"
                          min="0"
                          step="1000"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                          Complaint / Additional Notes
                        </label>
                        <Textarea
                          value={formData.complaint}
                          onChange={(e) => setFormData({ ...formData, complaint: e.target.value })}
                          rows={4}
                          className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb]"
                          placeholder="Tell us about your concerns, goals, or any special requirements..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      {isPrefill && prefillDietitianId ? (
                        // Skip to step 3 if dietitian is already pre-selected
                        <Button
                          onClick={() => setStep(3)}
                          className="bg-white hover:bg-gray-100 text-black px-6 py-2"
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setStep(2)}
                          className="bg-white hover:bg-gray-100 text-black px-6 py-2"
                        >
                          Continue
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 - Two Columns - Skip if pre-filled from consultation request */}
          {step === 2 && !(isPrefill && prefillDietitianId) && (
            <div className="flex justify-center p-8">
              <div className="w-full max-w-5xl grid grid-cols-2 divide-x divide-[#262626]">
                {/* Left Pane - Service Information */}
                <div className="p-8 space-y-6">
                  {/* Logo and Brand */}
                  <div className="flex items-center gap-2 mb-4">
                    <Image
                      src="/daiyet logo.svg"
                      alt="Daiyet"
                      width={100}
                      height={30}
                      className="h-6 w-auto"
                    />
                  </div>

                  {/* Service Title and Description */}
                  <div>
                    <h2 className="text-2xl font-semibold text-[#f9fafb] mb-4">
                      {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.title || availableEventTypes[0]?.title || "1-on-1 Consultation with Licensed Dietician"}
                    </h2>
                    <p className="text-sm text-[#9ca3af] leading-relaxed mb-6">
                      {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.description || availableEventTypes[0]?.description || "Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]"}
                    </p>
                  </div>

                  {/* Service Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-[#9ca3af]" />
                      <span className="text-sm text-[#f9fafb]">
                        {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.length || availableEventTypes[0]?.length || 45}m
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-[#9ca3af]" />
                      <span className="text-sm text-[#f9fafb]">Google Meet</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#f9fafb]">Africa/Lagos</span>
                        <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                      </div>
                    </div>
                    {(selectedEventTypeId || availableEventTypes.length > 0) && (
                      <div className="bg-white rounded-lg px-6 py-4 mt-3 w-fit">
                        <span className="text-2xl font-semibold text-black">
                          {eventTypePrice === 0 ? "Free" : `₦${eventTypePrice.toLocaleString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Pane - Select Dietician */}
                <div className="p-8">
                  <div>
                    <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Select Dietician</h2>
                    {loadingDietitians ? (
                      <div className="text-center py-8">
                        <div className="text-[#9ca3af]">Loading dietitians...</div>
                      </div>
                    ) : dietitians.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-[#9ca3af]">No dietitians available</div>
                      </div>
                    ) : (
                    <div className="space-y-4">
                        {dietitians.map((dietician) => {
                        const isSelected = selectedDietician === dietician.id;
                        const isDisabled = isPrefill && isReschedule;
                        return (
                          <div
                            key={dietician.id}
                            className={`border rounded-lg p-4 transition-all ${
                              isDisabled
                                ? "opacity-50 cursor-not-allowed border-[#262626] bg-transparent"
                                : isSelected
                                ? "border-white bg-[#171717] ring-1 ring-white/30 cursor-pointer"
                                : "border-[#262626] bg-transparent hover:bg-[#171717] cursor-pointer"
                            }`}
                            onClick={() => !isDisabled && setSelectedDietician(dietician.id)}
                          >
                            <div className="flex items-start gap-4">
                              {/* Profile Image */}
                              <div className="flex-shrink-0">
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#262626]">
                                  {dietician.profileImage ? (
                                    <Image
                                      src={dietician.profileImage}
                                      alt={dietician.name}
                                      width={64}
                                      height={64}
                                      className="w-full h-full object-cover grayscale"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-white text-lg font-semibold">
                                        {dietician.name.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Name and Qualification */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-medium text-[#f9fafb] mb-1">
                                    {dietician.name}
                                  </h3>
                                  {isSelected && (
                                    <div className="flex items-center gap-1 text-xs text-white bg-[#2b2b2b] px-2 py-1 rounded-full">
                                      <Check className="h-3 w-3" />
                                      Selected
                                    </div>
                                  )}
                                </div>
                                <p className="text-xs text-[#9ca3af]">
                                  {dietician.qualification}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-3 py-1 text-xs flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingProfile(dietician);
                                }}
                              >
                                View Profile
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                    <div className="flex gap-3 mt-6">
                      {isPrefill && prefillDietitianId ? (
                        // If pre-filled from request, skip dietitian selection (already on step 3)
                        null
                      ) : (
                        <>
                          <Button
                            onClick={() => setStep(1)}
                            variant="outline"
                            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={() => setStep(3)}
                            disabled={!selectedDietician}
                            className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
                          >
                            Continue
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 - Three Columns */}
          {step === 3 && (
            <div className="flex justify-center p-8">
              <div className="w-full max-w-7xl grid grid-cols-3 divide-x divide-[#262626]">
                {/* Left Pane - Service Information */}
                <div className="p-8 space-y-6">
                  {/* Logo and Brand */}
                  <div className="flex items-center gap-2 mb-4">
                    <Image
                      src="/daiyet logo.svg"
                      alt="Daiyet"
                      width={100}
                      height={30}
                      className="h-6 w-auto"
                    />
                  </div>

                  {/* Service Title and Description */}
                  <div>
                    <h2 className="text-2xl font-semibold text-[#f9fafb] mb-4">
                      {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.title || availableEventTypes[0]?.title || "1-on-1 Consultation with Licensed Dietician"}
                    </h2>
                    <p className="text-sm text-[#9ca3af] leading-relaxed mb-6">
                      {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.description || availableEventTypes[0]?.description || "Have one on one consultation with Licensed Dietitician [Nutritional counseling and treatment plan]"}
                    </p>
                  </div>

                  {/* Service Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-[#9ca3af]" />
                      <span className="text-sm text-[#f9fafb]">
                        {selectedEventTypeId && eventTypes.find(et => et.id === selectedEventTypeId)?.length || availableEventTypes[0]?.length || 45}m
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-[#9ca3af]" />
                      <span className="text-sm text-[#f9fafb]">Google Meet</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[#f9fafb]">Africa/Lagos</span>
                        <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                      </div>
                    </div>
                    {(selectedEventTypeId || availableEventTypes.length > 0) && (
                      <div className="bg-white rounded-lg px-6 py-4 mt-3 w-fit">
                        <span className="text-2xl font-semibold text-black">
                          {eventTypePrice === 0 ? "Free" : `₦${eventTypePrice.toLocaleString()}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 mt-6">
                    {isPrefill && prefillDietitianId ? (
                      // If pre-filled, back goes to step 1 (info), not step 2
                      <Button
                        onClick={() => setStep(1)}
                        variant="outline"
                        className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                      >
                        Back
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setStep(2)}
                        variant="outline"
                        className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                      >
                        Back
                      </Button>
                    )}
                  </div>
                </div>

                {/* Middle Pane - Event Type Selection & Calendar */}
                <div className="p-8">
                  {/* Event Type Selection (if multiple available) */}
                  {eventTypes.length > 1 && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-[#D4D4D4] mb-2">
                        Select Event Type
                      </label>
                      <select
                        value={selectedEventTypeId}
                        onChange={(e) => {
                          setSelectedEventTypeId(e.target.value);
                          const eventType = eventTypes.find(et => et.id === e.target.value);
                          if (eventType) {
                            setEventTypePrice(eventType.price);
                          }
                        }}
                        className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
                      >
                        {eventTypes.map((et) => (
                          <option key={et.id} value={et.id}>
                            {et.title} ({et.length}m) - ₦{et.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePreviousMonth}
                      className="text-[#D4D4D4] hover:text-[#f9fafb]"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="text-sm font-medium text-[#f9fafb]">
                      {currentMonth.format("MMMM YYYY")}
                    </h3>
                    <button
                      onClick={handleNextMonth}
                      className="text-[#D4D4D4] hover:text-[#f9fafb]"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {daysOfWeek.map((day) => (
                      <div
                        key={day}
                        className="text-xs text-[#9ca3af] text-center py-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-10" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const isAvailable = isDateAvailable(day);
                      const isSelected = isDateSelected(day);
                      const isTodayDate = isToday(day);

                      return (
                        <button
                          key={day}
                          onClick={() => handleDateClick(day)}
                          className={`h-10 rounded text-sm transition-colors ${
                            isSelected
                              ? "bg-white text-black font-medium"
                              : isAvailable
                              ? "bg-[#262626] text-[#f9fafb] hover:bg-[#404040]"
                              : "text-[#9ca3af] opacity-50 cursor-not-allowed"
                          } ${isTodayDate && !isSelected ? "ring-1 ring-[#404040]" : ""}`}
                          disabled={!isAvailable}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-xs text-[#9ca3af]">Cal.com</span>
                  </div>
                    <div className="flex gap-3 mt-6">
                      <Button
                        onClick={() => {
                          if (isPrefill && prefillDietitianId) {
                            // Skip dietitian selection, go back to step 1
                            setStep(1);
                          } else {
                            setStep(2);
                          }
                        }}
                        variant="outline"
                        className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={() => setStep(4)}
                        disabled={!selectedDate || !selectedTime}
                        className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
                      >
                        Continue
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Pane - Time Slots */}
                {selectedDate && (
                  <div className="p-8">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-[#f9fafb]">
                          {dayjs(selectedDate).format("ddd D")}
                        </h3>
                        <div className="flex gap-2">
                          <button className="text-xs px-2 py-1 bg-white text-black rounded">
                            12h
                          </button>
                          <button className="text-xs px-2 py-1 bg-transparent text-[#9ca3af] rounded">
                            24h
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {loadingTimeSlots ? (
                          <div className="text-center py-8 text-sm text-[#9ca3af]">
                            Loading available times...
                          </div>
                        ) : timeSlots.length === 0 ? (
                          <div className="text-center py-8 text-sm text-[#9ca3af]">
                            No available times for this date
                          </div>
                        ) : (
                          timeSlots.map((time) => {
                          const isSelected = selectedTime === time;
                          return (
                            <button
                              key={time}
                              onClick={() => handleTimeSelect(time)}
                              className={`w-full h-10 rounded text-xs flex items-center gap-2 px-3 transition-colors ${
                                isSelected
                                  ? "bg-white text-black font-medium"
                                  : "bg-transparent border border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
                              }`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              {formatTime(time)}
                            </button>
                          );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4 - One Column */}
          {step === 4 && (
            <div className="flex justify-center p-8">
              <div className="w-full max-w-2xl">
                <div className="p-8">
                  <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">Order Summary</h2>
                  <div className="border border-[#262626] rounded-lg p-6 space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Dietician</span>
                      <span className="text-[#f9fafb]">
                        {dietitianName || dietitians.find(d => d.id === selectedDietician)?.name || "Not selected"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Date</span>
                      <span className="text-[#f9fafb]">
                        {selectedDate ? dayjs(selectedDate).format("MMM D, YYYY") : ""}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Time</span>
                      <span className="text-[#f9fafb]">{formatTime(selectedTime)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Service Type</span>
                      <span className="text-[#f9fafb]">
                        {eventTypes.find(et => et.id === selectedEventTypeId)?.title || "Not selected"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Duration</span>
                      <span className="text-[#f9fafb]">
                        {eventTypes.find(et => et.id === selectedEventTypeId)?.length || 45} minutes
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Name</span>
                      <span className="text-[#f9fafb]">
                        {formData.name || userProfile?.name || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#9ca3af]">Email</span>
                      <span className="text-[#f9fafb]">
                        {formData.email || userProfile?.email || "N/A"}
                      </span>
                    </div>
                    {formData.age && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9ca3af]">Age</span>
                        <span className="text-[#f9fafb]">{formData.age}</span>
                      </div>
                    )}
                    {formData.occupation && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#9ca3af]">Occupation</span>
                        <span className="text-[#f9fafb]">{formData.occupation}</span>
                      </div>
                    )}
                    <div className="border-t border-[#262626] pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-[#f9fafb]">Total</span>
                        <span className="text-lg font-semibold text-[#f9fafb]">₦{eventTypePrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleCheckoutClick}
                      className="bg-white hover:bg-gray-100 text-black px-6 py-2"
                    >
                      {isReschedule ? "Confirm Reschedule" : "Proceed to Payment"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Screen */}
          {step === 5 && bookingDetails && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-[#f9fafb] mb-2">Booking Confirmed!</h2>
              <p className="text-sm text-[#9ca3af] mb-6">
                Your booking has been confirmed
              </p>
              <div className="border border-[#262626] rounded-lg p-6 space-y-4 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Date</div>
                    <div className="text-sm text-[#f9fafb]">
                      {dayjs(bookingDetails.date).format("MMM D, YYYY")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Time</div>
                    <div className="text-sm text-[#f9fafb]">
                      {formatTime(bookingDetails.time)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Duration</div>
                    <div className="text-sm text-[#f9fafb]">{bookingDetails.duration}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-[#9ca3af]" />
                  <div>
                    <div className="text-xs text-[#9ca3af]">Meeting Link</div>
                    <a
                      href={bookingDetails.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {bookingDetails.meetingLink}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="space-y-3 mt-6 max-w-md mx-auto">
                <Button
                  onClick={() => window.open(bookingDetails.meetingLink, '_blank')}
                  className="w-full bg-white hover:bg-gray-100 text-black px-6 py-2"
                >
                  Join Meeting
                </Button>
                <div className="text-sm text-[#9ca3af] mb-2">Add to Calendar</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 text-xs"
                  >
                    Google Calendar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 text-xs"
                  >
                    Outlook
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-4 py-2 text-xs"
                  >
                    iCal
                  </Button>
                </div>
                <Button
                  onClick={() => {
                    setStep(1);
                    setSelectedDate(null);
                    setSelectedTime("");
                    setSelectedDietician("");
                    setBookingDetails(null);
                  }}
                  variant="outline"
                  className="w-full bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
                >
                  Book Another Session
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {!isReschedule && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={handlePaymentSuccess}
          amount={eventTypePrice}
          currency="NGN"
          description={selectedDietician && dietitians.find(d => d.id === selectedDietician) 
            ? `Consultation with ${dietitians.find(d => d.id === selectedDietician)?.name}`
            : "Consultation Booking"}
          requestType="CONSULTATION"
          requestId={prefillRequestId || undefined}
          bookingId={bookingDetails?.id || undefined}
          userEmail={formData.email || userProfile?.email || sessionEmail || ""}
          userName={formData.name || userProfile?.name || sessionName || ""}
        />
      )}

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleSuccessModalClose}
        requestType="CONSULTATION"
        amount={paymentData?.amount || eventTypePrice || 15000}
        currency={paymentData?.currency || "NGN"}
        bookingDetails={bookingDetails}
        onViewDetails={() => {
          setIsSuccessModalOpen(false);
          router.push("/user-dashboard/upcoming-meetings");
        }}
      />

      {/* View Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl p-6 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#f9fafb]">Dietician Profile</h2>
              <button
                onClick={() => setViewingProfile(null)}
                className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="space-y-6">
              {/* Profile Image */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-[#262626]">
                  {viewingProfile.profileImage ? (
                    <Image
                      src={viewingProfile.profileImage}
                      alt={viewingProfile.name}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover grayscale"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white text-3xl font-semibold">
                        {viewingProfile.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Name and Qualification */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-[#f9fafb] mb-2">
                  {viewingProfile.name}
                </h3>
                <p className="text-sm text-[#9ca3af]">
                  {viewingProfile.qualification}
                </p>
              </div>

              {/* Professional Summary */}
              <div className="border-t border-[#262626] pt-6">
                <h4 className="text-sm font-medium text-[#D4D4D4] mb-3">Professional Summary</h4>
                <p className="text-sm text-[#9ca3af] leading-relaxed">
                  {viewingProfile.description || viewingProfile.bio || "No professional summary available."}
                </p>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-[#262626]">
                <Button
                  onClick={() => setViewingProfile(null)}
                  className="bg-white hover:bg-gray-100 text-black px-6 py-2"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Navigation - Mobile only */}
      <UserBottomNavigation />
    </div>
  );
}

export default function BookACallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading booking page...</div>
      </div>
    }>
      <BookACallPageContent />
    </Suspense>
  );
}
