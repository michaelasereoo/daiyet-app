"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TimeSlotPickerProps {
  date: Date;
  duration: number; // in minutes
  availableSlots?: string[];
  onSelectTime: (time: string) => void;
  selectedTime?: string;
  className?: string;
  dietitianId?: string; // Optional: if provided, will fetch real availability
}

// Generate time slots for a day (9 AM to 6 PM) - fallback
function generateTimeSlots(duration: number): string[] {
  const slots: string[] = [];
  const start = dayjs().hour(9).minute(0);
  const end = dayjs().hour(18).minute(0);

  let current = start;
  while (current.isBefore(end)) {
    slots.push(current.format("HH:mm"));
    current = current.add(duration, "minute");
  }

  return slots;
}

export function TimeSlotPicker({
  date,
  duration,
  availableSlots,
  onSelectTime,
  selectedTime,
  className,
  dietitianId,
}: TimeSlotPickerProps) {
  const [realAvailableSlots, setRealAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch real availability if dietitianId is provided
  useEffect(() => {
    if (dietitianId && date) {
      const fetchAvailability = async () => {
        try {
          setLoadingSlots(true);
          const dateStr = dayjs(date).format("YYYY-MM-DD");
          const nextDayStr = dayjs(date).add(1, "day").format("YYYY-MM-DD");

          console.log('📅 [DEBUG] TimeSlotPicker fetching for:', {
            date: dateStr,
            startDate: dateStr,
            endDate: nextDayStr,
            dietitianId,
            duration
          });

          const response = await fetch(
            `/api/availability/timeslots?dietitianId=${dietitianId}&startDate=${dateStr}&endDate=${nextDayStr}&duration=${duration}`,
            {
              credentials: "include",
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log('✅ [DEBUG] TimeSlotPicker received response:', {
              slotsCount: data.slots?.length || 0,
              timezone: data.timezone,
              scheduleId: data.scheduleId,
              rawSlots: data.slots?.slice(0, 3)
            });
            
            // Convert ISO datetime slots to HH:mm format
            const formattedSlots = (data.slots || [])
              .filter((slot: any) => {
                const slotDate = dayjs(slot.start);
                return slotDate.isSame(dayjs(date), "day");
              })
              .map((slot: any) => dayjs(slot.start).format("HH:mm"));
            
            console.log('🕒 [DEBUG] TimeSlotPicker formatted slots:', {
              formattedCount: formattedSlots.length,
              formattedSlots: formattedSlots.slice(0, 5)
            });
            
            setRealAvailableSlots(formattedSlots);
          } else {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            console.error('❌ [DEBUG] TimeSlotPicker API error:', {
              status: response.status,
              error: errorData
            });
          }
        } catch (err) {
          console.error("❌ [DEBUG] Error fetching availability:", err);
        } finally {
          setLoadingSlots(false);
        }
      };

      fetchAvailability();
    }
  }, [dietitianId, date, duration]);

  // Use real slots if available, otherwise use provided availableSlots, otherwise fallback
  const allSlots = generateTimeSlots(duration);
  const slots = realAvailableSlots.length > 0 
    ? realAvailableSlots 
    : (availableSlots || allSlots);

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-base sm:text-lg font-semibold text-[#111827]">
        {dayjs(date).format("dddd, MMMM D, YYYY")}
      </h3>
      {loadingSlots && (
        <div className="text-sm text-gray-500">Loading available times...</div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {slots.length === 0 && !loadingSlots ? (
          <div className="col-span-4 text-sm text-gray-500 text-center py-4">
            No available times for this date
          </div>
        ) : (
          slots.map((time) => {
          const isSelected = selectedTime === time;
          const slotDateTime = dayjs(date).hour(parseInt(time.split(":")[0])).minute(parseInt(time.split(":")[1]));
          const isPast = slotDateTime.isBefore(dayjs());

          return (
            <Button
              key={time}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => !isPast && onSelectTime(time)}
                disabled={isPast || loadingSlots}
              className={cn(
                "h-14 sm:h-12",
                  isPast && "opacity-50 cursor-not-allowed",
                  loadingSlots && "opacity-50"
              )}
            >
                {dayjs(`2000-01-01 ${time}`).format("h:mm A")}
            </Button>
          );
          })
        )}
      </div>
    </div>
  );
}
