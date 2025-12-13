"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface CopyTimesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceDay: string;
  sourceSlots: Array<{ start: string; end: string }>;
  allDays: string[];
  onApply: (selectedDays: string[]) => void;
}

export function CopyTimesModal({
  isOpen,
  onClose,
  sourceDay,
  sourceSlots,
  allDays,
  onApply,
}: CopyTimesModalProps) {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      // Don't include the source day in the initial selection
      setSelectedDays([]);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const toggleSelectAll = () => {
    const availableDays = allDays.filter((d) => d !== sourceDay);
    if (selectedDays.length === availableDays.length) {
      setSelectedDays([]);
    } else {
      setSelectedDays([...availableDays]);
    }
  };

  const handleApply = () => {
    if (selectedDays.length > 0) {
      onApply(selectedDays);
    }
    onClose();
  };

  if (!isOpen) return null;

  const availableDays = allDays.filter((d) => d !== sourceDay);
  const allSelected = availableDays.length > 0 && selectedDays.length === availableDays.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-[#171717] border border-[#262626] rounded-lg shadow-xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#262626]">
          <h3 className="text-sm font-semibold text-[#f9fafb] uppercase tracking-wide">
            Copy Times To
          </h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#f9fafb] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Source day info */}
          <div className="mb-4 pb-4 border-b border-[#262626]">
            <p className="text-xs text-[#9ca3af] mb-1">Copying from</p>
            <p className="text-sm font-medium text-[#f9fafb]">{sourceDay}</p>
            <div className="mt-2 text-xs text-[#9ca3af]">
              {sourceSlots.length > 0 ? (
                sourceSlots.map((slot, idx) => (
                  <span key={idx}>
                    {slot.start} - {slot.end}
                    {idx < sourceSlots.length - 1 && ", "}
                  </span>
                ))
              ) : (
                <span>No time slots</span>
              )}
            </div>
          </div>

          {/* Day checkboxes */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* Select All */}
            <label className="flex items-center gap-3 p-2 hover:bg-[#262626] rounded cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-[#404040] bg-[#0a0a0a] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-sm text-[#f9fafb] font-medium">Select All</span>
            </label>

            {/* Individual days */}
            {availableDays.map((day) => (
              <label
                key={day}
                className="flex items-center gap-3 p-2 hover:bg-[#262626] rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedDays.includes(day)}
                  onChange={() => toggleDay(day)}
                  className="w-4 h-4 rounded border-[#404040] bg-[#0a0a0a] text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-[#f9fafb]">{day}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#262626]">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedDays.length === 0}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

