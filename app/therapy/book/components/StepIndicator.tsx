"use client";

interface StepIndicatorProps {
  currentStep: number;
  prefillTherapistId?: string | null;
}

export function StepIndicator({ currentStep, prefillTherapistId }: StepIndicatorProps) {
  return (
    <div className="border-b border-[#262626] px-4 sm:px-8 py-3 sm:py-4">
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
        {[1, 2, 3, 4].map((s) => {
          // Hide step 3 (therapist selection) if pre-filled
          if (s === 3 && prefillTherapistId) {
            return null;
          }
          const isStepActive = currentStep >= s;
          const isStep3Active = currentStep >= 3 || (s === 3 && prefillTherapistId);
          
          return (
            <div key={s} className="flex items-center flex-shrink-0">
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                  isStepActive || (s === 3 && isStep3Active)
                    ? "bg-white text-black"
                    : "bg-[#262626] text-[#9ca3af]"
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`w-4 sm:w-8 md:w-12 h-0.5 ${
                    (s === 1 && currentStep >= 2) ||
                    (s === 2 && (currentStep >= 3 || prefillTherapistId)) ||
                    (s === 3 && currentStep >= 4)
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
  );
}

