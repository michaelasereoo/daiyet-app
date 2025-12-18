"use client";

import { Button } from "@/components/ui/button";
import dayjs from "dayjs";

interface Step5TimeSelectionProps {
  selectedDate: Date | null;
  timeSlots: string[];
  selectedTime: string;
  loadingTimeSlots: boolean;
  onTimeSelect: (time: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${ampm}`;
}

export function Step5TimeSelection({
  selectedDate,
  timeSlots,
  selectedTime,
  loadingTimeSlots,
  onTimeSelect,
  onBack,
  onContinue,
}: Step5TimeSelectionProps) {
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-white mb-2">Select Time</h2>
        {selectedDate && (
          <p className="text-sm text-[#9ca3af] mb-6">
            {dayjs(selectedDate).format("dddd, MMMM D, YYYY")}
          </p>
        )}
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto mb-6">
          {loadingTimeSlots ? (
            <div className="text-center py-8 text-[#9ca3af]">Loading time slots...</div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8 text-[#9ca3af]">No available times for this date</div>
          ) : (
            timeSlots.map((time) => {
              const isSelected = selectedTime === time;
              return (
                <button
                  key={time}
                  onClick={() => onTimeSelect(time)}
                  className={`w-full h-12 rounded text-sm flex items-center gap-2 px-4 transition-colors ${
                    isSelected
                      ? "bg-white text-black font-medium"
                      : "bg-transparent border border-[#262626] text-[#f9fafb] hover:bg-[#171717]"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-black" : "bg-green-500"}`} />
                  {formatTime(time)}
                </button>
              );
            })
          )}
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#171717] px-6 py-2"
          >
            Back
          </Button>
          <Button
            onClick={onContinue}
            disabled={!selectedTime}
            className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

