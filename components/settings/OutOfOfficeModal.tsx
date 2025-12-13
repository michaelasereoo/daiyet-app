"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";

interface OutOfOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    startDate: Date;
    endDate: Date;
    reason: string;
    notes: string;
    forwardToTeam: boolean;
    forwardUrl?: string;
  }) => void;
  editingPeriod?: {
    id: string;
    startDate: string | Date;
    endDate: string | Date;
    reason: string;
    notes: string;
    forwardToTeam: boolean;
    forwardUrl?: string | null;
  } | null;
}

export function OutOfOfficeModal({ isOpen, onClose, onCreate, editingPeriod = null }: OutOfOfficeModalProps) {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState("Unspecified");
  const [notes, setNotes] = useState("");
  const [forwardToTeam, setForwardToTeam] = useState(false);
  const [forwardUrl, setForwardUrl] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectingStart, setSelectingStart] = useState(true);

  // Load editing period data when modal opens
  useEffect(() => {
    if (editingPeriod && isOpen) {
      const start = typeof editingPeriod.startDate === "string" 
        ? new Date(editingPeriod.startDate) 
        : editingPeriod.startDate;
      const end = typeof editingPeriod.endDate === "string" 
        ? new Date(editingPeriod.endDate) 
        : editingPeriod.endDate;
      setStartDate(start);
      setEndDate(end);
      setReason(editingPeriod.reason || "Unspecified");
      setNotes(editingPeriod.notes || "");
      setForwardToTeam(editingPeriod.forwardToTeam || false);
      setForwardUrl(editingPeriod.forwardUrl || "");
    } else if (isOpen && !editingPeriod) {
      // Reset form for new entry
      setStartDate(null);
      setEndDate(null);
      setReason("Unspecified");
      setNotes("");
      setForwardToTeam(false);
      setForwardUrl("");
      setSelectingStart(true);
    }
  }, [editingPeriod, isOpen]);

  if (!isOpen) return null;

  const startOfMonth = currentMonth.startOf("month");
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfWeek = startOfMonth.day();
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const handleDateClick = (date: Date) => {
    if (selectingStart || !startDate) {
      // Start selecting range
      setStartDate(date);
      setEndDate(null);
      setSelectingStart(false);
    } else {
      // Complete the range
      if (dayjs(date).isBefore(dayjs(startDate))) {
        // If clicked date is before start, make it the new start
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
      setSelectingStart(true);
      setShowCalendar(false);
    }
  };

  const isDateInRange = (date: Date) => {
    if (!startDate) return false;
    if (!endDate) return false;
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    const startStr = dayjs(startDate).format("YYYY-MM-DD");
    const endStr = dayjs(endDate).format("YYYY-MM-DD");
    return dateStr >= startStr && dateStr <= endStr;
  };

  const isStartDate = (date: Date) => {
    if (!startDate) return false;
    return dayjs(date).format("YYYY-MM-DD") === dayjs(startDate).format("YYYY-MM-DD");
  };

  const isEndDate = (date: Date) => {
    if (!endDate) return false;
    return dayjs(date).format("YYYY-MM-DD") === dayjs(endDate).format("YYYY-MM-DD");
  };

  const formatDateRange = () => {
    if (!startDate) return "";
    if (!endDate) {
      return dayjs(startDate).format("MMM D, YYYY");
    }
    return `${dayjs(startDate).format("MMM D, YYYY")} - ${dayjs(endDate).format("MMM D, YYYY")}`;
  };

  const handleCreate = () => {
    if (startDate && endDate) {
      onCreate({
        startDate,
        endDate,
        reason,
        notes,
        forwardToTeam,
        forwardUrl: forwardToTeam ? forwardUrl : undefined,
      });
      // Reset form
      setStartDate(null);
      setEndDate(null);
      setReason("Unspecified");
      setNotes("");
      setForwardToTeam(false);
      setForwardUrl("");
      setSelectingStart(true);
      onClose();
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, "month"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#171717] border border-[#262626] rounded-lg w-full max-w-2xl p-6 shadow-lg">
        {/* Title */}
        <h2 className="text-lg font-semibold text-[#f9fafb] mb-6">
          Go Out Of Office
        </h2>

        {/* Form Fields */}
        <div className="space-y-6 mb-6">
          {/* Dates */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Dates
            </label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={formatDateRange()}
                  readOnly
                  onClick={() => setShowCalendar(!showCalendar)}
                  placeholder="Select dates"
                  className="flex-1 bg-[#0a0a0a] border-[#262626] text-[#f9fafb] cursor-pointer focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
                />
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="text-[#D4D4D4] hover:text-[#f9fafb] transition-colors"
                >
                  <Calendar className="h-5 w-5" />
                </button>
              </div>

              {/* Calendar Popup */}
              {showCalendar && (
                <div className="absolute top-full left-0 mt-2 bg-[#171717] border border-[#262626] rounded-lg p-4 shadow-lg z-10 w-full max-w-sm">
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
                      const isStart = isStartDate(date);
                      const isEnd = isEndDate(date);
                      const inRange = isDateInRange(date);

                      return (
                        <button
                          key={index}
                          onClick={() => handleDateClick(date)}
                          className={`
                            aspect-square rounded-md text-sm transition-colors relative
                            ${
                              isStart || isEnd
                                ? "bg-white text-[#0a0a0a] font-medium"
                                : inRange
                                ? "bg-[#404040] text-[#f9fafb]"
                                : "text-[#D4D4D4] hover:bg-[#262626]"
                            }
                          `}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Reason
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <Clock className="h-4 w-4 text-[#9ca3af]" />
              </div>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-10 py-2 pr-8 appearance-none focus:outline-none focus:ring-0 focus:border-[#404040]"
              >
                <option value="Unspecified">Unspecified</option>
                <option value="Vacation">Vacation</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Personal">Personal</option>
                <option value="Holiday">Holiday</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9ca3af] pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#D4D4D4]">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
              className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 min-h-[100px] resize-none"
            />
          </div>

          {/* Forward to Team Toggle */}
          <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-[#D4D4D4]">
              Provide a link to a team member when OOO
            </label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={forwardToTeam}
                onChange={(e) => setForwardToTeam(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#374151] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9ca3af]"></div>
            </label>
            </div>
            {forwardToTeam && (
              <Input
                type="url"
                value={forwardUrl}
                onChange={(e) => setForwardUrl(e.target.value)}
                placeholder="https://example.com/team-member"
                className="bg-[#0a0a0a] border-[#262626] text-[#f9fafb] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040]"
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="bg-transparent border-[#262626] text-[#f9fafb] hover:bg-[#262626] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            className="bg-white hover:bg-gray-100 text-black px-4 py-2"
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
