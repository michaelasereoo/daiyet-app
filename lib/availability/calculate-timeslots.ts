/**
 * Calculate available time slots based on availability schedules, date overrides, out-of-office periods, and existing bookings
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { TimezoneHelper } from "@/lib/utils/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export interface TimeSlot {
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  available: boolean;
}

export interface AvailabilitySlot {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM:SS format
  endTime: string; // HH:MM:SS format
  enabled: boolean;
}

export interface Booking {
  startTime: string; // ISO 8601 datetime
  endTime: string; // ISO 8601 datetime
  status: string;
}

export interface DateOverride {
  overrideDate: string; // YYYY-MM-DD
  isUnavailable: boolean;
  slots?: Array<{
    startTime: string; // HH:MM:SS format
    endTime: string; // HH:MM:SS format
  }>;
}

export interface OutOfOfficePeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Calculate available time slots for a given date range
 */
export function calculateAvailableSlots(
  date: Date,
  availabilitySlots: AvailabilitySlot[],
  existingBookings: Booking[],
  durationMinutes: number,
  timezone: string = "Africa/Lagos"
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  
  // CRITICAL FIX: Use TimezoneHelper for all timezone operations
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const dayOfWeek = TimezoneHelper.getDayOfWeek(dateStr, timezone);
  const dayName = TimezoneHelper.getDayName(dateStr, timezone);
  
  console.log('🔍 [FIXED] calculateAvailableSlots day calculation:', {
    inputDate: date.toISOString(),
    dateStr,
    timezone,
    calculatedDayOfWeek: dayOfWeek,
    dayName
  });

  // Find availability slots for this day
  const daySlots = availabilitySlots.filter(
    (slot) => slot.dayOfWeek === dayOfWeek && slot.enabled
  );

  if (daySlots.length === 0) {
    console.log(`❌ [FIXED] No slots found for ${dayName} (day ${dayOfWeek})`);
    return []; // No availability for this day
  }

  console.log(`✅ [FIXED] Found ${daySlots.length} slots for ${dayName}`);

  // Get current time in the schedule's timezone to filter out past slots
  const nowInTimezone = TimezoneHelper.now(timezone);

  // For each availability slot, generate time slots
  daySlots.forEach((availabilitySlot) => {
    console.log(`🕒 [FIXED] Processing slot: ${availabilitySlot.startTime} to ${availabilitySlot.endTime}`);

    // CRITICAL FIX: Parse times using TimezoneHelper in the schedule's timezone
    const slotStart = TimezoneHelper.parseDatabaseTime(dateStr, availabilitySlot.startTime, timezone);
    const slotEnd = TimezoneHelper.parseDatabaseTime(dateStr, availabilitySlot.endTime, timezone);

    console.log(`📊 [FIXED] Parsed times: ${slotStart.format()} to ${slotEnd.format()}`);

    // Skip if slot is in the past
    if (slotStart.isBefore(nowInTimezone)) {
      console.log(`⏰ [FIXED] Slot is in the past, skipping`);
      return;
    }

    // Generate slots of the specified duration
    let currentTime = slotStart;

    while (currentTime.isBefore(slotEnd)) {
      const slotEndTime = currentTime.add(durationMinutes, "minute");

      // Don't create slots that extend beyond the availability window
      if (slotEndTime.isAfter(slotEnd)) {
        break;
      }

      // Check if this slot conflicts with existing bookings
      const conflicts = existingBookings.some((booking) => {
        const bookingStart = dayjs(booking.startTime).tz(timezone);
        const bookingEnd = dayjs(booking.endTime).tz(timezone);

        // Check for overlap using dayjs comparison
        return (
          currentTime.isBefore(bookingEnd) && 
          slotEndTime.isAfter(bookingStart)
        );
      });

      if (!conflicts) {
        slots.push({
          start: currentTime.toISOString(),
          end: slotEndTime.toISOString(),
          available: true,
        });
        console.log(`✅ [FIXED] Added slot: ${currentTime.format("HH:mm")} - ${slotEndTime.format("HH:mm")}`);
      } else {
        console.log(`🚫 [FIXED] Slot conflicts with booking: ${currentTime.format("HH:mm")}`);
      }

      // Move to next slot (increment by duration) - create new instance to avoid mutation
      currentTime = currentTime.add(durationMinutes, "minute");
    }
  });

  return slots.sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Check if a date is within any out-of-office period
 */
export function checkOutOfOffice(
  date: Date,
  oooPeriods: OutOfOfficePeriod[]
): boolean {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  return oooPeriods.some((period) => {
    return dateStr >= period.startDate && dateStr <= period.endDate;
  });
}

/**
 * Get date override for a specific date
 */
export function getDateOverride(
  date: Date,
  overrides: DateOverride[]
): DateOverride | null {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  return overrides.find((override) => override.overrideDate === dateStr) || null;
}

/**
 * Calculate available slots for a date with override support
 */
function calculateAvailableSlotsWithOverride(
  date: Date,
  availabilitySlots: AvailabilitySlot[],
  existingBookings: Booking[],
  durationMinutes: number,
  timezone: string,
  override: DateOverride | null
): TimeSlot[] {
  // If override exists and is unavailable, return no slots
  if (override?.isUnavailable) {
    return [];
  }

  // If override exists and has custom slots, use those instead of base schedule
  if (override?.slots && override.slots.length > 0) {
    const overrideAvailabilitySlots: AvailabilitySlot[] = override.slots.map((slot) => ({
      dayOfWeek: date.getDay(),
      startTime: slot.startTime,
      endTime: slot.endTime,
      enabled: true,
    }));

    return calculateAvailableSlots(
      date,
      overrideAvailabilitySlots,
      existingBookings,
      durationMinutes,
      timezone
    );
  }

  // Otherwise, use base schedule
  return calculateAvailableSlots(
    date,
    availabilitySlots,
    existingBookings,
    durationMinutes,
    timezone
  );
}

/**
 * Calculate available slots for a date range with OOO and override support
 */
export function calculateSlotsForDateRange(
  startDate: Date,
  endDate: Date,
  availabilitySlots: AvailabilitySlot[],
  existingBookings: Booking[],
  durationMinutes: number,
  timezone: string = "Africa/Lagos",
  oooPeriods: OutOfOfficePeriod[] = [],
  dateOverrides: DateOverride[] = []
): TimeSlot[] {
  console.log('🧮 [DEBUG] calculateSlotsForDateRange called with:', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    availabilitySlotsCount: availabilitySlots?.length || 0,
    bookingsCount: existingBookings?.length || 0,
    durationMinutes,
    timezone,
    oooPeriodsCount: oooPeriods?.length || 0,
    dateOverridesCount: dateOverrides?.length || 0
  });

  console.log('📅 [DEBUG] availabilitySlots sample:', availabilitySlots?.slice(0, 3));
  console.log('📅 [DEBUG] bookings sample:', existingBookings?.slice(0, 3));
  
  const allSlots: TimeSlot[] = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  const daysInRange = Math.ceil((end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log('📆 [DEBUG] Date range:', {
    currentDate: currentDate.toISOString(),
    end: end.toISOString(),
    daysInRange
  });
  
  let processedDays = 0;
  while (currentDate <= end) {
    processedDays++;
    const dateStr = currentDate.toISOString().split('T')[0];
    // CRITICAL FIX: Use TimezoneHelper for day of week calculation
    const dayOfWeek = TimezoneHelper.getDayOfWeek(dateStr, timezone);
    const dayName = TimezoneHelper.getDayName(dateStr, timezone);
    
    console.log(`📅 [DEBUG] Processing date ${processedDays}/${daysInRange}: ${dateStr} (${dayName}, dayOfWeek=${dayOfWeek})`);
    
    // Priority 1: Check if date is in out-of-office period
    if (checkOutOfOffice(currentDate, oooPeriods)) {
      console.log(`🚫 [DEBUG] Date ${dateStr} is OOO, skipping`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Check if we have availability slots for this day
    const slotsForDay = availabilitySlots.filter(s => s.dayOfWeek === dayOfWeek && s.enabled);
    console.log(`📊 [DEBUG] Date ${dateStr} has ${slotsForDay.length} availability slots for ${dayName}`);
    
    if (slotsForDay.length === 0) {
      console.log(`❌ [DEBUG] No availability slots for ${dayName} (dayOfWeek=${dayOfWeek})`);
      console.log(`   Available slots by day:`, availabilitySlots.reduce((acc, s) => {
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.dayOfWeek];
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
    }

    // Priority 2: Check for date override
    const override = getDateOverride(currentDate, dateOverrides);
    if (override) {
      console.log(`🔄 [DEBUG] Date ${dateStr} has override:`, {
        isUnavailable: override.isUnavailable,
        customSlotsCount: override.slots?.length || 0
      });
    }

    // Calculate slots (override will be handled inside the function)
    const daySlots = calculateAvailableSlotsWithOverride(
      currentDate,
      availabilitySlots,
      existingBookings,
      durationMinutes,
      timezone,
      override
    );
    
    console.log(`📊 [DEBUG] Date ${dateStr} generated ${daySlots.length} slots`);
    if (daySlots.length > 0) {
      console.log(`🕒 [DEBUG] Sample slots for ${dateStr}:`, daySlots.slice(0, 2));
    } else {
      console.log(`❌ [DEBUG] No slots generated for ${dateStr}. Reasons:`);
      console.log(`   - Availability slots for ${dayName}:`, slotsForDay);
      const bookingsOnDate = existingBookings?.filter(b => {
        const bookingDate = new Date(b.startTime);
        return bookingDate.toISOString().split('T')[0] === dateStr;
      }) || [];
      console.log(`   - Bookings on this date:`, bookingsOnDate.length);
    }
    
    allSlots.push(...daySlots);

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`✅ [DEBUG] Total slots generated: ${allSlots.length} across ${processedDays} days`);
  return allSlots;
}

