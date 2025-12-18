"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface Therapist {
  id: string;
  name: string;
  qualification: string;
  profileImage?: string;
  description: string;
}

interface Step3TherapistSelectionProps {
  therapists: Therapist[];
  loadingTherapists: boolean;
  selectedTherapist: string;
  viewingProfile: Therapist | null;
  onTherapistSelect: (therapistId: string) => void;
  onViewProfile: (therapist: Therapist) => void;
  onCloseProfile: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Step3TherapistSelection({
  therapists,
  loadingTherapists,
  selectedTherapist,
  viewingProfile,
  onTherapistSelect,
  onViewProfile,
  onCloseProfile,
  onBack,
  onContinue,
}: Step3TherapistSelectionProps) {
  return (
    <>
      <div className="p-6 md:p-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-white mb-6">Select a Therapist</h2>
          
          {loadingTherapists ? (
            <div className="text-center py-8 text-[#9ca3af]">Loading therapists...</div>
          ) : therapists.length === 0 ? (
            <div className="text-center py-8 text-[#9ca3af]">No therapists available</div>
          ) : (
            <div className="space-y-4">
              {therapists.map((therapist) => {
                const isSelected = selectedTherapist === therapist.id;
                return (
                  <div
                    key={therapist.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer ${
                      isSelected
                        ? "border-white bg-[#171717] ring-1 ring-white/30"
                        : "border-[#262626] hover:bg-[#171717]"
                    }`}
                    onClick={() => onTherapistSelect(therapist.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-[#262626]">
                          {therapist.profileImage ? (
                            <Image
                              src={therapist.profileImage}
                              alt={therapist.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white text-lg font-semibold">
                                {therapist.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-[#f9fafb] mb-1">
                            {therapist.name}
                          </h3>
                          {isSelected && (
                            <div className="flex items-center gap-1 text-xs text-white bg-[#2b2b2b] px-2 py-1 rounded-full">
                              <Check className="h-3 w-3" />
                              Selected
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-[#9ca3af] mb-2">
                          {therapist.qualification}
                        </p>
                        <p className="text-xs text-[#9ca3af] line-clamp-2">
                          {therapist.description}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-3 py-1 text-xs flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProfile(therapist);
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
            <Button
              onClick={onBack}
              variant="outline"
              className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
            >
              Back
            </Button>
            <Button
              onClick={onContinue}
              disabled={!selectedTherapist}
              className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
      
      {/* View Profile Modal */}
      {viewingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#f9fafb]">Therapist Profile</h2>
              <button
                onClick={onCloseProfile}
                className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-[#262626]">
                  {viewingProfile.profileImage ? (
                    <Image
                      src={viewingProfile.profileImage}
                      alt={viewingProfile.name}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
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
              
              <div className="text-center">
                <h3 className="text-xl font-semibold text-[#f9fafb] mb-2">
                  {viewingProfile.name}
                </h3>
                <p className="text-sm text-[#9ca3af]">
                  {viewingProfile.qualification}
                </p>
              </div>
              
              <div className="border-t border-[#262626] pt-6">
                <h4 className="text-sm font-medium text-[#D4D4D4] mb-3">Professional Summary</h4>
                <p className="text-sm text-[#9ca3af] leading-relaxed whitespace-pre-line">
                  {viewingProfile.description || "No professional summary available."}
                </p>
              </div>
              
              <div className="flex justify-end pt-4 border-t border-[#262626]">
                <Button
                  onClick={onCloseProfile}
                  className="bg-white hover:bg-gray-100 text-black px-6 py-2"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

