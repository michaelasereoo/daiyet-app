"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

interface Step4DateSelectionProps {
  currentMonth: dayjs.Dayjs;
  daysInMonth: number;
  firstDayOfWeek: number;
  daysOfWeek: string[];
  availableDates: string[];
  selectedDate: Date | null;
  loadingDates: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onDateClick: (day: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Step4DateSelection({
  currentMonth,
  daysInMonth,
  firstDayOfWeek,
  daysOfWeek,
  availableDates,
  selectedDate,
  loadingDates,
  onPreviousMonth,
  onNextMonth,
  onDateClick,
  onBack,
  onContinue,
}: Step4DateSelectionProps) {
  const isDateAvailable = (day: number) => availableDates.includes(String(day));
  const isDateSelected = (day: number) => selectedDate && dayjs(selectedDate).isSame(currentMonth.date(day), "day");
  const isToday = (day: number) => dayjs().isSame(currentMonth.date(day), "day");
  
  return (
    <div className="p-6 md:p-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-white mb-6 text-center">Select a Date</h2>
        
        <div className="flex items-center justify-between mb-4">
          <button onClick={onPreviousMonth} className="text-[#9ca3af] hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-sm font-medium text-white">
            {currentMonth.format("MMMM YYYY")}
          </h3>
          <button onClick={onNextMonth} className="text-[#9ca3af] hover:text-white">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-xs text-[#9ca3af] text-center py-2">
              {day}
            </div>
          ))}
        </div>
        
        {loadingDates ? (
          <div className="text-center py-8 text-[#9ca3af]">Loading availability...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const available = isDateAvailable(day);
              const selected = isDateSelected(day);
              const today = isToday(day);
              
              return (
                <button
                  key={day}
                  onClick={() => available && onDateClick(day)}
                  disabled={!available}
                  className={`h-10 rounded text-sm transition-colors ${
                    selected
                      ? "bg-white text-black font-medium"
                      : available
                      ? "bg-[#262626] text-white hover:bg-[#404040]"
                      : "text-[#9ca3af] opacity-50 cursor-not-allowed"
                  } ${today && !selected ? "ring-1 ring-[#404040]" : ""}`}
                >
                  {day}
                </button>
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
            disabled={!selectedDate}
            className="bg-white hover:bg-gray-100 text-black px-6 py-2 disabled:opacity-50"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

