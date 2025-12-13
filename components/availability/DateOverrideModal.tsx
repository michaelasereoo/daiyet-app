"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import dayjs from "dayjs";

interface DateOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (overrides: Array<{ date: Date; type: "unavailable" | "available"; slots?: Array<{ start: string; end: string }> }>) => void;
  existingDates?: Date[];
  editingOverride?: {
    id: string;
    date: string | Date;
    type: string;
    slots?: Array<{ start: string; end: string }>;
  } | null;
}

export function DateOverrideModal({
  isOpen,
  onClose,
  onSave,
  existingDates = [],
  editingOverride = null,
}: DateOverrideModalProps) {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDates, setSelectedDates] = useState<Date[]>(existingDates);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [timeSlots, setTimeSlots] = useState<Array<{ start: string; end: string }>>([
    { start: "9:00am", end: "5:00pm" },
  ]);

  useEffect(() => {
    if (editingOverride) {
      // Load editing override data
      const date = typeof editingOverride.date === "string" 
        ? new Date(editingOverride.date) 
        : editingOverride.date;
      setSelectedDates([date]);
      setIsUnavailable(editingOverride.type === "unavailable");
      if (editingOverride.slots && editingOverride.slots.length > 0) {
        setTimeSlots(editingOverride.slots);
      } else {
        setTimeSlots([{ start: "9:00am", end: "5:00pm" }]);
      }
    } else if (existingDates.length > 0) {
      setSelectedDates(existingDates);
      setIsUnavailable(false);
      setTimeSlots([{ start: "9:00am", end: "5:00pm" }]);
    } else {
      // Reset form
      setSelectedDates([]);
      setIsUnavailable(false);
      setTimeSlots([{ start: "9:00am", end: "5:00pm" }]);
    }
  }, [existingDates, editingOverride, isOpen]);

  if (!isOpen) return null;

  const startOfMonth = currentMonth.startOf("month");
  const endOfMonth = currentMonth.endOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();

  const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  const handleDateClick = (date: Date) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    setSelectedDates((prev) => {
      const isSelected = prev.some(
        (d) => dayjs(d).format("YYYY-MM-DD") === dateStr
      );
      if (isSelected) {
        return prev.filter((d) => dayjs(d).format("YYYY-MM-DD") !== dateStr);
      } else {
        return [...prev, date];
      }
    });
  };

  const isDateSelected = (date: Date) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    return selectedDates.some(
      (d) => dayjs(d).format("YYYY-MM-DD") === dateStr
    );
  };

  const isToday = (date: Date) => {
    return dayjs(date).isSame(dayjs(), "day");
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  const handleAddTimeSlot = () => {
    const lastSlot = timeSlots[timeSlots.length - 1];
    setTimeSlots([
      ...timeSlots,
      { start: lastSlot.end, end: "5:00pm" },
    ]);
  };

  const handleUpdateTimeSlot = (index: number, field: "start" | "end", value: string) => {
    const newSlots = [...timeSlots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setTimeSlots(newSlots);
  };

  const handleDeleteTimeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const overrides = selectedDates.map((date) => ({
      date,
      type: isUnavailable ? ("unavailable" as const) : ("available" as const),
      slots: isUnavailable ? undefined : timeSlots,
    }));
    onSave(overrides);
    onClose();
    // Reset form
    setSelectedDates([]);
    setIsUnavailable(false);
    setTimeSlots([{ start: "9:00am", end: "5:00pm" }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-5xl p-6 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Date Selection */}
          <div>
            {/* Title */}
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">
              Select the dates to override
            </h2>

            {/* Calendar */}
            <div className="mb-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePreviousMonth}
              className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-base font-medium text-[#f9fafb]">
              {currentMonth.format("MMMM YYYY")}
            </div>
            <button
              onClick={handleNextMonth}
              className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-[#9ca3af] py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square"></div>
            ))}

            {/* Calendar dates */}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const date = startOfMonth.add(index, "day").toDate();
              const isSelected = isDateSelected(date);
              const isTodayDate = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  className={`
                    aspect-square rounded-md text-sm transition-colors
                    ${
                      isSelected
                        ? "bg-[#404040] text-[#f9fafb] hover:bg-[#525252]"
                        : "text-[#D4D4D4] hover:bg-[#262626]"
                    }
                  `}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span>{index + 1}</span>
                    {isTodayDate && !isSelected && (
                      <span className="w-1 h-1 bg-[#f9fafb] rounded-full mt-0.5"></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
          </div>

          {/* Right Panel: Time Slot Configuration */}
          <div>
            <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">
              Which hours are you free?
            </h2>

            {/* Mark Unavailable Toggle */}
            <div className="mb-6">
              <label className="relative inline-flex items-center cursor-pointer w-full">
                <input
                  type="checkbox"
                  checked={isUnavailable}
                  onChange={(e) => setIsUnavailable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
                <span className="ml-3 text-sm text-[#D4D4D4]">
                  Mark unavailable (All day)
                </span>
              </label>
            </div>

            {/* Time Slots */}
            {!isUnavailable && (
              <div className="space-y-3 mb-6">
                {timeSlots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={slot.start}
                      onChange={(e) =>
                        handleUpdateTimeSlot(index, "start", e.target.value)
                      }
                      className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] text-sm w-24"
                    />
                    <span className="text-[#9ca3af]">-</span>
                    <Input
                      type="text"
                      value={slot.end}
                      onChange={(e) =>
                        handleUpdateTimeSlot(index, "end", e.target.value)
                      }
                      className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] text-sm w-24"
                    />
                    {index === timeSlots.length - 1 && (
                      <button
                        onClick={handleAddTimeSlot}
                        className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {index > 0 && (
                      <button
                        onClick={() => handleDeleteTimeSlot(index)}
                        className="text-[#D4D4D4] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-[#262626]">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2"
          >
            Save Override
          </Button>
        </div>
      </div>
    </div>
  );
}
