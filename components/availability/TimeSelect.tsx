"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

// Generate time options in 15-minute increments
function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      times.push(timeStr);
    }
  }
  return times;
}

// Convert 24-hour format (HH:MM) to 12-hour format (h:MM AM/PM)
function formatTime24To12(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24;
  
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")}${period}`;
}

// Convert 12-hour format (h:MMam/pm) to 24-hour format (HH:MM)
function formatTime12To24(time12: string): string {
  if (!time12) return "09:00";
  
  // Handle various formats: "9:00am", "9:00 am", "9:00AM", etc.
  const cleaned = time12.toLowerCase().trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
  
  if (!match) {
    // Try to parse as 24-hour format
    const match24 = cleaned.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
      const hour = parseInt(match24[1]);
      const minute = parseInt(match24[2]);
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      }
    }
    return "09:00"; // Default fallback
  }
  
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const period = match[3];
  
  if (period === "pm" && hour !== 12) {
    hour += 12;
  } else if (period === "am" && hour === 12) {
    hour = 0;
  }
  
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimeSelect({ value, onChange, className, disabled }: TimeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [previousValue, setPreviousValue] = useState(value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const timeOptions = generateTimeOptions();
  
  // Convert current value to 24-hour format for matching
  const currentValue24 = formatTime12To24(value);
  const displayValue = formatTime24To12(currentValue24);

  // Update previous value when value prop changes (but not when we're typing)
  useEffect(() => {
    if (!isOpen) {
      setPreviousValue(value);
    }
  }, [value, isOpen]);

  // Filter options based on search - show all if no search term
  const filteredOptions = timeOptions.filter((time) => {
    if (!searchTerm || searchTerm.trim() === "") return true;
    const time12 = formatTime24To12(time).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return time12.includes(searchLower) || time.includes(searchLower);
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        // Revert to previous value if no selection was made
        if (value !== previousValue) {
          onChange(previousValue);
        }
      }
    }

    if (isOpen) {
      // Use a small delay to ensure the click event is processed
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, value, previousValue, onChange]);

  const handleSelect = (time24: string) => {
    const time12 = formatTime24To12(time24);
    onChange(time12);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // If user types a valid time, try to match it
    if (newValue.length >= 3) {
      const time24 = formatTime12To24(newValue);
      const matchingOption = timeOptions.find((opt) => opt === time24);
      if (matchingOption) {
        // Don't update yet, let them select from dropdown
      }
    }
  };

  const handleInputFocus = () => {
    if (!isOpen) {
      setPreviousValue(value); // Save current value before opening
      setIsOpen(true);
      setSearchTerm("");
    }
  };

  const handleInputClick = () => {
    if (!isOpen) {
      setPreviousValue(value); // Save current value before opening
      setIsOpen(true);
      setSearchTerm("");
    }
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Use setTimeout to allow click events to fire first
    setTimeout(() => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(document.activeElement) &&
        inputRef.current !== document.activeElement
      ) {
        setIsOpen(false);
        setSearchTerm("");
        // Revert to previous value if no selection was made
        if (value !== previousValue) {
          onChange(previousValue);
        }
      }
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          onBlur={handleInputBlur}
          disabled={disabled}
          readOnly={!isOpen}
          className={cn(
            "bg-[#0a0a0a] border border-[#262626] text-[#f9fafb] text-sm rounded px-3 py-2 pr-8 w-28 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:border-[#404040] cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          placeholder="9:00am"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const newIsOpen = !isOpen;
            if (newIsOpen) {
              setPreviousValue(value); // Save current value before opening
              setIsOpen(true);
              setSearchTerm("");
              // Focus the input when opening
              setTimeout(() => {
                inputRef.current?.focus();
              }, 0);
            } else {
              setIsOpen(false);
              setSearchTerm("");
              // Revert to previous value if no selection was made
              if (value !== previousValue) {
                onChange(previousValue);
              }
            }
          }}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[#9ca3af] hover:text-[#f9fafb] transition-colors pointer-events-auto"
          tabIndex={-1}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform pointer-events-none",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] mt-1 bg-[#171717] border border-[#262626] rounded-lg shadow-xl max-h-60 overflow-y-auto"
          style={{ 
            minWidth: "140px",
            width: "140px",
            top: "100%",
            left: 0,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((time24) => {
                const time12 = formatTime24To12(time24);
                const isSelected = time24 === currentValue24;
                
                return (
                  <button
                    key={time24}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(time24);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm text-[#f9fafb] hover:bg-[#262626] transition-colors cursor-pointer whitespace-nowrap",
                      isSelected && "bg-[#404040] font-medium"
                    )}
                  >
                    {time12}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-[#9ca3af]">
              No times found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

