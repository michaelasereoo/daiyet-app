'use client';

// Removed unused imports - dates calculated directly in component
import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Video, Globe, ChevronDown, ArrowRight } from "lucide-react";

export default function TherapyPage() {
  // DEBUG: Component lifecycle
  useEffect(() => {
    console.log('🏠 [TherapyPage] Component mounted');
    console.log('🏠 [TherapyPage] Current URL:', window.location.href);
    console.log('🏠 [TherapyPage] User Agent:', navigator.userAgent);
    
    return () => {
      console.log('🏠 [TherapyPage] Component unmounting');
    };
  }, []);

  // Calculate dates directly - no need for useEffect since this is a client component
  // This prevents the loading state from blocking rendering
  const today = new Date();
  const currentMonthName = today.toLocaleString("en-US", { month: "long" });
  const currentYear = today.getFullYear();
  
  // DEBUG: Date calculations
  useEffect(() => {
    console.log('📅 [TherapyPage] Date calculations:', {
      today: today.toISOString(),
      currentMonth: currentMonthName,
      currentYear: currentYear,
      dayOfWeek: today.getDay(),
    });
  }, []);

  // Calculate start of week
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Calendar dates array
  const calendarDates = Array.from({ length: 7 }).map((_, i) => {
    const dateObj = new Date(startOfWeek);
    dateObj.setDate(startOfWeek.getDate() + i);
    return dateObj;
  });

  // DEBUG: Calendar dates
  useEffect(() => {
    console.log('📅 [TherapyPage] Calendar dates generated:', {
      startOfWeek: startOfWeek.toISOString(),
      dates: calendarDates.map(d => d.toISOString()),
      count: calendarDates.length,
    });
  }, []);

  // Handle button clicks
  const handlePrevMonth = () => {
    console.log('🔘 [TherapyPage] Previous month button clicked');
    console.log('🔘 [TherapyPage] Current month:', currentMonthName, currentYear);
    // TODO: Implement calendar navigation
  };

  const handleNextMonth = () => {
    console.log('🔘 [TherapyPage] Next month button clicked');
    console.log('🔘 [TherapyPage] Current month:', currentMonthName, currentYear);
    // TODO: Implement calendar navigation
  };

  // DEBUG: Render logging
  useEffect(() => {
    console.log('🎨 [TherapyPage] Component rendering with:', {
      calendarDatesCount: calendarDates.length,
      currentMonth: currentMonthName,
      currentYear: currentYear,
    });
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/therapy" className="flex items-center gap-2 sm:gap-3">
            <Image
              src="/daiyet logo.svg"
              alt="Daiyet"
              width={120}
              height={32}
              className="h-7 sm:h-8 w-auto"
              priority
              onError={(e) => {
                console.error('🖼️ [TherapyPage] Logo image failed to load');
                const target = e.target as HTMLImageElement;
                console.log('🖼️ [TherapyPage] Image error details:', {
                  src: target.src,
                  naturalWidth: target.naturalWidth,
                  naturalHeight: target.naturalHeight,
                });
                target.style.display = 'none';
                // Show text fallback
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.logo-fallback')) {
                  console.log('🖼️ [TherapyPage] Creating text fallback for logo');
                  const fallback = document.createElement('span');
                  fallback.textContent = 'Daiyet';
                  fallback.className = 'logo-fallback text-xl font-bold text-white';
                  parent.appendChild(fallback);
                }
              }}
              onLoad={() => {
                console.log('🖼️ [TherapyPage] Logo image loaded successfully');
              }}
            />
            <span className="hidden sm:inline text-xs sm:text-sm text-white/60">Therapy</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login?source=therapy"
              className="flex items-center text-white/80 hover:text-white transition-colors text-xs sm:text-sm px-2 sm:px-0"
              onClick={(e) => {
                console.log('🔗 [TherapyPage] Login link clicked');
                // Fallback navigation if Next.js routing fails
                if (e.defaultPrevented) {
                  console.warn('🔗 [TherapyPage] Login click was prevented');
                  return;
                }
                // Let Next.js handle it normally, but have fallback
                setTimeout(() => {
                  if (window.location.pathname !== '/login') {
                    console.log('🔗 [TherapyPage] Fallback navigation to /login');
                    window.location.href = '/login?source=therapy';
                  } else {
                    console.log('🔗 [TherapyPage] Already on /login, navigation successful');
                  }
                }, 100);
              }}
            >
              Login
            </Link>
            <Link 
              href="/signup?source=therapy"
              className="bg-[#FFF4E0] text-black hover:bg-[#ffe9c2] text-xs sm:text-sm h-8 sm:h-10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md inline-flex items-center justify-center font-medium transition-colors"
              onClick={(e) => {
                console.log('🔗 [TherapyPage] Signup link clicked (header - Get Started)');
                // Fallback navigation if Next.js routing fails
                if (e.defaultPrevented) {
                  console.warn('🔗 [TherapyPage] Signup click was prevented');
                  return;
                }
                setTimeout(() => {
                  if (window.location.pathname !== '/signup') {
                    console.log('🔗 [TherapyPage] Fallback navigation to /signup');
                    window.location.href = '/signup?source=therapy';
                  } else {
                    console.log('🔗 [TherapyPage] Already on /signup, navigation successful');
                  }
                }, 100);
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-6 sm:px-6 min-h-[calc(100vh-80px)] flex items-center justify-center py-8 sm:py-16">
          <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="space-y-6 self-center text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/70">
                <span className="w-2 h-2 rounded-full bg-[#E5FF53]"></span>
                Now serving patients in Nigeria
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Book Licensed Therapists today!
              </h1>
              <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Schedule virtual appointments with licensed therapists specializing in your mental health needs and receive personalized support designed to help you achieve lasting wellness.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link 
                  href="/therapy/book"
                  className="bg-[#FFF4E0] text-black hover:bg-[#ffe9c2] h-10 sm:h-12 px-6 py-2 sm:py-3 rounded-md inline-flex items-center justify-center font-medium transition-colors"
                  onClick={(e) => {
                console.log('🔗 [TherapyPage] Book a Call button clicked');
                // Fallback navigation if Next.js routing fails
                if (e.defaultPrevented) {
                  console.warn('🔗 [TherapyPage] Book a Call click was prevented');
                  return;
                }
                setTimeout(() => {
                  if (window.location.pathname !== '/therapy/book') {
                    console.log('🔗 [TherapyPage] Fallback navigation to /therapy/book');
                    window.location.href = '/therapy/book';
                  } else {
                    console.log('🔗 [TherapyPage] Already on /therapy/book, navigation successful');
                  }
                }, 100);
              }}
                >
                  Book a Call <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
                <Link 
                  href="/login?source=therapy"
                  className="border border-white/20 text-white hover:bg-white/5 h-10 sm:h-12 px-6 py-2 sm:py-3 rounded-md inline-flex items-center justify-center font-medium transition-colors"
                  onClick={(e) => {
                    console.log('🔗 [TherapyPage] Get Tailored Support button clicked');
                    // Fallback navigation if Next.js routing fails
                    if (e.defaultPrevented) {
                      console.warn('🔗 [TherapyPage] Get Tailored Support click was prevented');
                      return;
                    }
                    setTimeout(() => {
                      if (window.location.pathname !== '/login') {
                        console.log('🔗 [TherapyPage] Fallback navigation to /login');
                        window.location.href = '/login?source=therapy';
                      } else {
                        console.log('🔗 [TherapyPage] Already on /login, navigation successful');
                      }
                    }, 100);
                  }}
                  aria-label="Get tailored support"
                >
                  Get Tailored Support
                </Link>
              </div>
              <div className="hidden sm:flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2 sm:gap-4 text-xs sm:text-sm text-white/60">
                <div className="flex items-center gap-1">
                  <span className="text-[#E5FF53]">●</span> Instant confirmations
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[#E5FF53]">●</span> Virtual and seamless
                </div>
              </div>
            </div>

            {/* Booking Card */}
            <div className="hidden sm:flex relative mt-8 sm:mt-16 lg:mt-14 mb-8 sm:mb-16 justify-center self-center w-full">
              <Card className="relative z-10 bg-[#FFF4E0] border border-[#f1e2c0] shadow-xl w-full max-w-[520px]">
                <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-[#374151] mb-1">Dr. Sarah Johnson</h3>
                <h4 className="text-xl font-semibold mb-1 text-[#111827]">Therapy Consultation</h4>
                <p className="text-sm text-[#4b5563] mb-6">
                  1-on-1 therapy session to discuss your concerns and develop a personalized treatment plan.
                </p>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1 text-sm text-[#111827]">
                    <Clock className="h-4 w-4 text-[#6b7280]" />
                    <span>Duration</span>
                  </div>
                  <div className="text-sm text-white font-medium bg-[#111827] border border-[#111827] rounded-md px-4 py-2 inline-flex">
                    45 minutes
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm text-[#111827]">
                  <Video className="h-4 w-4 text-[#6b7280]" />
                  <span>Google Meet</span>
                </div>

                <div className="flex items-center gap-2 mb-6 text-sm text-[#111827]">
                  <Globe className="h-4 w-4 text-[#6b7280]" />
                  <span>Africa/Lagos</span>
                  <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
                </div>

                <div className="border-t border-[#e5e7eb] pt-6">
                    <div className="flex items-center justify-between mb-4 text-sm text-[#111827]">
                    <h5 className="font-semibold">
                      {currentMonthName} {currentYear}
                    </h5>
                    <div className="flex gap-2 text-[#9ca3af]">
                      <button 
                        className="p-1 hover:bg-[#f3f4f6] rounded"
                        onClick={handlePrevMonth}
                        aria-label="Previous month"
                      >
                        {"<"}
                      </button>
                      <button 
                        className="p-1 hover:bg-[#f3f4f6] rounded"
                        onClick={handleNextMonth}
                        aria-label="Next month"
                      >
                        {">"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2 text-[11px] text-[#9ca3af]">
                    {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                      <div key={day} className="text-center py-2 font-medium">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDates.map((dateObj, i) => {
                      if (!dateObj) return null;
                      
                      const dateNum = dateObj.getDate();
                      const isCurrentMonth = dateObj.getMonth() === today.getMonth();
                      const isSelected = dateObj.toDateString() === today.toDateString();
                      const isAvailable = true;
                      const hasDot = isSelected;
                      
                      return (
                        <button
                          key={dateObj.toISOString()}
                          className={`aspect-square text-sm rounded-md transition-colors flex items-center justify-center ${
                            isSelected
                              ? "bg-[#111827] text-white"
                              : isAvailable
                                ? `hover:bg-white hover:text-[#111827] ${
                                    isCurrentMonth ? "text-[#111827]" : "text-[#9ca3af]"
                                  }`
                                : "text-[#cbd5e1] cursor-not-allowed"
                          }`}
                          disabled={!isAvailable}
                          aria-label={`Select ${dateObj.toLocaleDateString()}`}
                          onClick={() => {
                            console.log('📅 [TherapyPage] Calendar date clicked:', {
                              date: dateObj.toLocaleDateString(),
                              iso: dateObj.toISOString(),
                              isSelected,
                              isCurrentMonth,
                              isAvailable,
                            });
                            // TODO: Implement date selection
                          }}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{dateNum}</span>
                            {hasDot && (
                              <span className="w-1 h-1 bg-[#111827] rounded-full mt-0.5"></span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/40">
        <div className="container mx-auto px-6 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-white/70">
          <span>© {new Date().getFullYear()} Daiyet. All rights reserved.</span>
          <div className="flex gap-4">
            <Link 
              href="/terms-of-service" 
              className="hover:text-white transition-colors"
              onClick={(e) => {
                console.log('🔗 [TherapyPage] Terms of Service link clicked');
                if (e.defaultPrevented) {
                  console.warn('🔗 [TherapyPage] Terms click was prevented');
                  return;
                }
                setTimeout(() => {
                  if (window.location.pathname !== '/terms-of-service') {
                    console.log('🔗 [TherapyPage] Fallback navigation to /terms-of-service');
                    window.location.href = '/terms-of-service';
                  } else {
                    console.log('🔗 [TherapyPage] Already on /terms-of-service');
                  }
                }, 100);
              }}
            >
              Terms of Service
            </Link>
            <Link 
              href="/privacy-policy" 
              className="hover:text-white transition-colors"
              onClick={(e) => {
                console.log('🔗 [TherapyPage] Privacy Policy link clicked');
                if (e.defaultPrevented) {
                  console.warn('🔗 [TherapyPage] Privacy click was prevented');
                  return;
                }
                setTimeout(() => {
                  if (window.location.pathname !== '/privacy-policy') {
                    console.log('🔗 [TherapyPage] Fallback navigation to /privacy-policy');
                    window.location.href = '/privacy-policy';
                  } else {
                    console.log('🔗 [TherapyPage] Already on /privacy-policy');
                  }
                }, 100);
              }}
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

