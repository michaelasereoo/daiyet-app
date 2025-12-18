"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TherapistProfile } from "@/types";
import { formatTherapistName } from "@/lib/utils/therapist-name";

// Default therapist event types
const defaultTherapistEventTypes = [
  {
    id: "individual-therapy-mini",
    title: "Individual Therapy Mini",
    slug: "individual-therapy-mini",
    description: "45-minute individual therapy session for personalized mental health support",
    length: 45,
    price: 15000,
    currency: "NGN"
  },
  {
    id: "student-therapy",
    title: "Student Therapy",
    slug: "student-therapy",
    description: "Affordable therapy session designed for students",
    length: 45,
    price: 10000,
    currency: "NGN"
  },
  {
    id: "individual-therapy-max",
    title: "Individual Therapy Max",
    slug: "individual-therapy-max",
    description: "Extended 90-minute individual therapy session for comprehensive mental health support",
    length: 90,
    price: 50000,
    currency: "NGN"
  }
];

function PublicTherapistProfileContent() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  // Therapist data
  const [therapist, setTherapist] = useState<TherapistProfile | null>(null);
  const [loadingTherapist, setLoadingTherapist] = useState(true);
  const [therapistError, setTherapistError] = useState<string | null>(null);
  
  // Fetch therapist by slug
  useEffect(() => {
    const fetchTherapist = async () => {
      if (!slug) return;
      
      setLoadingTherapist(true);
      setTherapistError(null);
      
      try {
        const response = await fetch(`/api/therapists/by-slug/${encodeURIComponent(slug)}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setTherapistError("Therapist not found");
          } else {
            setTherapistError("Failed to load therapist profile");
          }
          return;
        }
        
        const data = await response.json();
        setTherapist(data.therapist);
      } catch (err) {
        console.error("Error fetching therapist:", err);
        setTherapistError("Failed to load therapist profile");
      } finally {
        setLoadingTherapist(false);
      }
    };
    
    fetchTherapist();
  }, [slug]);
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "T";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  
  // Loading state
  if (loadingTherapist) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (therapistError || !therapist) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-4">
            {therapistError || "Therapist not found"}
          </h1>
          <p className="text-[#9ca3af] mb-6">
            The therapist profile you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/therapy"
            className="inline-block bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-2 rounded-md font-medium transition-colors"
          >
            Back to Therapy Home
          </Link>
        </div>
      </div>
    );
  }
  
  // Build booking URL with therapist ID pre-filled
  const bookingUrl = `/therapy/book-a-call?therapistId=${therapist.id}`;
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
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
            />
            <span className="hidden sm:inline text-xs sm:text-sm text-white/60">Therapy</span>
          </Link>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-6 sm:px-6 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
            <div className="flex-shrink-0">
              {therapist.image ? (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-[#262626]">
                  <Image
                    src={therapist.image}
                    alt={therapist.name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#262626] flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-semibold text-white">
                    {getInitials(therapist.name)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                {formatTherapistName(therapist.name)}
              </h1>
              <p className="text-[#9ca3af] mb-2">Licensed Therapist</p>
              {therapist.location && (
                <p className="text-sm text-[#9ca3af]">{therapist.location}</p>
              )}
            </div>
            <div className="w-full sm:w-auto">
              <Link
                href={bookingUrl}
                className="block w-full sm:w-auto bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-3 rounded-md font-medium transition-colors text-center"
              >
                Book a Session
              </Link>
            </div>
          </div>
          
          {/* Bio Section */}
          {therapist.bio && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">About</h2>
              <p className="text-[#9ca3af] leading-relaxed whitespace-pre-line">
                {therapist.bio}
              </p>
            </div>
          )}
          
          {/* Qualifications */}
          {therapist.qualifications && therapist.qualifications.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Qualifications</h2>
              <ul className="list-disc list-inside text-[#9ca3af] space-y-2">
                {therapist.qualifications.map((qual, index) => (
                  <li key={index}>{qual}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Experience */}
          {therapist.experience && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Experience</h2>
              <p className="text-[#9ca3af] leading-relaxed">
                {therapist.experience}
              </p>
            </div>
          )}
          
          {/* License Number */}
          {therapist.licenseNumber && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">License</h2>
              <p className="text-[#9ca3af]">
                License Number: {therapist.licenseNumber}
              </p>
            </div>
          )}
          
          {/* CTA Section */}
          <div className="mt-12 p-6 bg-[#171717] border border-[#262626] rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-4">Ready to Get Started?</h2>
            <p className="text-[#9ca3af] mb-6">
              Book a therapy session with {formatTherapistName(therapist.name)} to begin your mental health journey.
            </p>
            <Link
              href={bookingUrl}
              className="inline-block bg-[#FFF4E0] hover:bg-[#ffe9c2] text-black px-6 py-3 rounded-md font-medium transition-colors"
            >
              Book a Session
            </Link>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/40 mt-12">
        <div className="container mx-auto px-6 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 text-xs sm:text-sm text-white/70">
          <span>© {new Date().getFullYear()} Daiyet. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/terms-of-service" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function PublicTherapistProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <PublicTherapistProfileContent />
    </Suspense>
  );
}

